import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// API endpoint to convert animated GIF files into MP4 video with faststart and yuv420p
app.post(
  '/api/convert-gif',
  express.raw({ type: ['image/gif', 'application/octet-stream', '*/*'], limit: '100mb' }),
  async (req, res) => {
    try {
      const buffer = req.body;
      if (!buffer || buffer.length === 0) {
        return res.status(400).send('Empty GIF data');
      }

      const tempId = `gif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const inputPath = path.join('/tmp', `${tempId}.gif`);
      const outputPath = path.join('/tmp', `${tempId}.mp4`);

      await fs.promises.writeFile(inputPath, buffer);

      // Run ffmpeg to convert GIF to H.264 MP4 with faststart and divisible dimensions
      const cmd = `ffmpeg -y -i "${inputPath}" -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${outputPath}"`;
      await new Promise<void>((resolve, reject) => {
        exec(cmd, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      const mp4Buffer = await fs.promises.readFile(outputPath);

      // Clean up temp files
      fs.promises.unlink(inputPath).catch(() => {});
      fs.promises.unlink(outputPath).catch(() => {});

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', mp4Buffer.length);
      res.send(mp4Buffer);
    } catch (err: any) {
      console.error('GIF conversion error:', err);
      res.status(500).send(err?.message || 'Conversion failed');
    }
  }
);

// Directory for processed remote media files
const mediaDir = path.join('/tmp', 'loopdeck_media');
fs.mkdirSync(mediaDir, { recursive: true });

// Server-side remote-media retrieval, detection, remuxing & transcoding proxy
app.post('/api/link-video', async (req, res) => {
  let rawPath = '';
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A valid video URL is required.' });
    }

    const trimmedUrl = url.trim();
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }

    // Connect and stream download with browser-like headers
    const response = await fetch(trimmedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return res.status(400).json({
        error: `Remote server returned HTTP ${response.status}: ${response.statusText}`,
      });
    }

    const id = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    rawPath = path.join(mediaDir, `${id}_raw`);

    const fileStream = fs.createWriteStream(rawPath);
    if (!response.body) {
      return res.status(400).json({ error: 'Remote server returned an empty body.' });
    }

    await new Promise<void>((resolve, reject) => {
      const reader = response.body!.getReader();
      async function pump() {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              fileStream.end();
              resolve();
              break;
            }
            if (value) {
              fileStream.write(value);
            }
          }
        } catch (e) {
          fileStream.destroy();
          reject(e);
        }
      }
      pump();
    });

    // Inspect media with ffprobe
    const probeCmd = `ffprobe -v error -show_entries format=format_name,duration:stream=codec_name,codec_type,width,height -of json "${rawPath}"`;
    const probeOut = await new Promise<string>((resolve, reject) => {
      exec(probeCmd, (err, stdout) => {
        if (err) reject(new Error('Unable to detect media format. Is this a valid video file?'));
        else resolve(stdout);
      });
    });

    let probeData: any = {};
    try {
      probeData = JSON.parse(probeOut);
    } catch {
      probeData = {};
    }

    const videoStream = probeData.streams?.find((s: any) => s.codec_type === 'video');
    const audioStream = probeData.streams?.find((s: any) => s.codec_type === 'audio');

    if (!videoStream) {
      fs.promises.unlink(rawPath).catch(() => {});
      return res.status(400).json({
        error: 'The provided URL does not contain an accessible video stream.',
      });
    }

    const vCodec = (videoStream.codec_name || '').toLowerCase();
    const aCodec = (audioStream?.codec_name || '').toLowerCase();
    const duration = parseFloat(probeData.format?.duration || '0');
    const width = videoStream.width || 0;
    const height = videoStream.height || 0;

    const isH264 = vCodec === 'h264' || vCodec === 'avc1';
    const isWebAudio = !audioStream || ['aac', 'mp3', 'opus'].includes(aCodec);
    const isVp8or9 = vCodec === 'vp8' || vCodec === 'vp9' || vCodec === 'av1';

    let outputFilename: string;
    let outputPath: string;
    let remuxed = false;
    let transcoded = false;

    if (isH264 && isWebAudio) {
      // Remux to faststart MP4 container (instant, lossless)
      outputFilename = `${id}.mp4`;
      outputPath = path.join(mediaDir, outputFilename);
      const remuxCmd = `ffmpeg -y -i "${rawPath}" -c copy -movflags faststart "${outputPath}"`;
      await new Promise<void>((resolve, reject) => {
        exec(remuxCmd, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      remuxed = true;
    } else if (isVp8or9 && (!audioStream || ['opus', 'vorbis'].includes(aCodec))) {
      // Remux to WebM container
      outputFilename = `${id}.webm`;
      outputPath = path.join(mediaDir, outputFilename);
      const remuxCmd = `ffmpeg -y -i "${rawPath}" -c copy "${outputPath}"`;
      await new Promise<void>((resolve, reject) => {
        exec(remuxCmd, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      remuxed = true;
    } else {
      // Transcode only when necessary to browser-standard H.264 MP4 with faststart
      outputFilename = `${id}.mp4`;
      outputPath = path.join(mediaDir, outputFilename);
      const transcodeCmd = `ffmpeg -y -i "${rawPath}" -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags faststart -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${outputPath}"`;
      await new Promise<void>((resolve, reject) => {
        exec(transcodeCmd, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      transcoded = true;
    }

    // Clean up temporary raw download
    fs.promises.unlink(rawPath).catch(() => {});

    // Derive readable video name
    let videoName = '';
    const contentDisp = response.headers.get('content-disposition');
    if (contentDisp && contentDisp.includes('filename=')) {
      const match = contentDisp.match(/filename=["']?([^"';]+)["']?/i);
      if (match && match[1]) {
        videoName = path.basename(match[1].trim());
      }
    }
    if (!videoName) {
      try {
        const parsedUrl = new URL(trimmedUrl);
        const urlBase = path.basename(parsedUrl.pathname);
        if (urlBase && urlBase !== '/' && urlBase.length > 2) {
          videoName = decodeURIComponent(urlBase);
        } else {
          videoName = `${parsedUrl.hostname}_video.${outputFilename.split('.').pop()}`;
        }
      } catch {
        videoName = `linked_video.${outputFilename.split('.').pop()}`;
      }
    }

    return res.json({
      success: true,
      id,
      name: videoName,
      streamUrl: `/api/media/${outputFilename}`,
      duration,
      width,
      height,
      remuxed,
      transcoded,
      format: outputFilename.split('.').pop(),
    });
  } catch (err: any) {
    if (rawPath) {
      fs.promises.unlink(rawPath).catch(() => {});
    }
    console.error('Link video processing error:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to retrieve or process remote video.',
    });
  }
});

// Serve processed media files with HTTP Range requests support & CORS headers
app.get('/api/media/:file', (req, res) => {
  const filename = path.basename(req.params.file);
  const filePath = path.join(mediaDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Media not found');
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

  res.sendFile(filePath, { acceptRanges: true });
});

// Vite middleware (dev) or static serving (prod)
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
