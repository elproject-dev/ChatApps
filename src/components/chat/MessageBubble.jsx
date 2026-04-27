import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck, Download, Globe, Play, Pause, Volume2, Video } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

// URL regex
const URL_REGEX = /(https?:\/\/[^\s<>)"']+)/gi;

// Extract URLs from text
function extractUrls(text) {
  if (!text) return [];
  return text.match(URL_REGEX) || [];
}

// Render text with clickable links
function renderTextWithLinks(text, isMine) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noreferrer"
          className={`underline break-all ${isMine ? 'text-primary-foreground' : 'text-green-500 hover:text-green-600'}`}
        >
          {part}
        </a>
      );
    }
    URL_REGEX.lastIndex = 0;
    return part;
  });
}

// Link preview component
function LinkPreview({ url, isMine }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchPreview = async () => {
      try {
        // Use a meta tag fetch approach via noembed (free, no API key)
        const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (!cancelled && data && !data.error) {
          setPreview({
            title: data.title || '',
            description: data.author_name || data.provider_name || '',
            image: data.thumbnail_url || '',
            site: data.provider_name || new URL(url).hostname,
          });
        }
      } catch {
        // Silently fail
      }
      if (!cancelled) setLoading(false);
    };
    fetchPreview();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className={`mt-1 rounded-lg border ${isMine ? 'border-primary-foreground/20 bg-primary-foreground/10' : 'border-border bg-muted/50'} p-2.5`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
          <span className="text-xs opacity-50">Memuat pratinjau...</span>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`mt-1 flex rounded-lg border overflow-hidden no-underline ${
        isMine ? 'border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/20' : 'border-border bg-muted/50 hover:bg-muted'
      } transition-colors`}
    >
      {preview.image && (
        <div className="w-24 h-24 flex-shrink-0 bg-muted">
          <img src={preview.image} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex-1 p-2.5 min-w-0">
        <p className={`text-xs font-medium truncate ${isMine ? 'text-primary-foreground' : 'text-foreground'}`}>
          {preview.title}
        </p>
        <p className={`text-[10px] mt-0.5 truncate ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
          {preview.description}
        </p>
        <div className={`flex items-center gap-1 mt-1.5 ${isMine ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>
          <Globe className="w-3 h-3 flex-shrink-0" />
          <span className="text-[10px] truncate">{preview.site}</span>
        </div>
      </div>
    </a>
  );
}

// Audio Player component
function AudioPlayer({ src, isMine, title }) {
  const audioRef = React.useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) setDuration(audio.duration);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const handleProgressClick = (e) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    audio.currentTime = pct * audio.duration;
  };

  return (
    <div className={`rounded-xl p-2.5 min-w-[200px] ${isMine ? 'bg-primary-foreground/10' : 'bg-muted/60'}`}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />
      <div className="flex items-center gap-2.5">
        <button
          onClick={togglePlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
            isMine ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30' : 'bg-primary/15 hover:bg-primary/25'
          }`}
        >
          {isPlaying ? (
            <Pause className={`w-4 h-4 ${isMine ? 'text-primary-foreground' : 'text-primary'}`} />
          ) : (
            <Play className={`w-4 h-4 ml-0.5 ${isMine ? 'text-primary-foreground' : 'text-primary'}`} />
          )}
        </button>
        <div className="flex-1 min-w-0">
          {/* Waveform-like progress bar */}
          <div
            className="h-1.5 rounded-full cursor-pointer overflow-hidden bg-black/10"
            onClick={handleProgressClick}
          >
            <div
              className={`h-full rounded-full transition-all duration-100 ${isMine ? 'bg-primary-foreground/60' : 'bg-primary/60'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={`flex justify-between mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
            <span className="text-[10px]">{formatTime(currentTime)}</span>
            <span className="text-[10px]">{formatTime(duration)}</span>
          </div>
        </div>
        <Volume2 className={`w-4 h-4 flex-shrink-0 ${isMine ? 'text-primary-foreground/40' : 'text-muted-foreground/60'}`} />
      </div>
      {title && (
        <p className={`text-[11px] mt-1 truncate ${isMine ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>
          {title}
        </p>
      )}
    </div>
  );
}

// Video Message component - thumbnail with play button, click to play
function VideoMessage({ src, isMine }) {
  const videoRef = React.useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbnail, setThumbnail] = useState(null);
  const [duration, setDuration] = useState('');
  const [videoError, setVideoError] = useState(false);

  // Generate thumbnail from video
  useEffect(() => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      // Seek to 1 second for thumbnail
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setThumbnail(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        // CORS or other error - use placeholder
        setThumbnail(null);
      }
    };

    video.onloadedmetadata = () => {
      const d = video.duration;
      if (d && isFinite(d)) {
        const m = Math.floor(d / 60);
        const s = Math.floor(d % 60);
        setDuration(`${m}:${s.toString().padStart(2, '0')}`);
      }
    };

    video.onerror = () => setVideoError(true);
    video.src = src;

    return () => {
      video.src = '';
    };
  }, [src]);

  const handlePlay = () => {
    setIsPlaying(true);
    setTimeout(() => {
      videoRef.current?.play();
    }, 100);
  };

  const formatDuration = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (videoError) {
    return (
      <div className="flex items-center justify-center py-8 px-4 rounded-lg bg-muted text-muted-foreground text-sm gap-2">
        <Video className="w-4 h-4" />
        Gagal memuat video
      </div>
    );
  }

  if (isPlaying) {
    return (
      <div className="relative overflow-hidden rounded-lg mb-1">
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          className="rounded-lg max-w-full max-h-[300px]"
          onEnded={() => setIsPlaying(false)}
        />
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-lg mb-1 cursor-pointer group"
      onClick={handlePlay}
    >
      {/* Thumbnail */}
      {thumbnail ? (
        <img src={thumbnail} alt="video thumbnail" className="rounded-lg max-w-full max-h-[300px] object-cover w-full" />
      ) : (
        <div className="w-[260px] h-[180px] bg-muted rounded-lg flex items-center justify-center">
          <Video className="w-10 h-10 text-muted-foreground/40" />
        </div>
      )}
      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
        <div className="w-12 h-12 rounded-full bg-black/40 shadow-lg flex items-center justify-center backdrop-blur-sm">
          <Play className="w-6 h-6 text-white ml-0.5" />
        </div>
      </div>
      {/* Duration badge */}
      {duration && (
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium">
          {duration}
        </div>
      )}
    </div>
  );
}

const SaveToGallery = Capacitor.isNativePlatform()
  ? registerPlugin('SaveToGallery')
  : null;

export default function MessageBubble({ message, isMine, showAvatar = false, currentUserEmail, onImageClick }) {
  const time = message.created_at ? format(new Date(message.created_at), 'HH:mm') : '';
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Determine checkmark status
  const isRead = message.read_by && message.read_by.length > 1;
  const isReceived = message.read_by && message.read_by.length >= 1;

  const handleDownloadImage = async () => {
    if (!message.file_url) return;

    try {
      if (Capacitor.isNativePlatform() && SaveToGallery) {
        // Native Android - save to gallery via MediaStore
        const result = await SaveToGallery.saveImage({
          url: message.file_url,
          fileName: `chat_image_${Date.now()}.jpg`,
        });
        alert('Gambar berhasil disimpan ke galeri!');
      } else {
        // Web - open in new tab
        window.open(message.file_url, '_blank');
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Gagal menyimpan gambar');
    }
  };

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} message-in`}>
      <div
        className={`relative max-w-[80%] px-3 py-2 rounded-2xl shadow-sm ${
          isMine
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-card text-card-foreground rounded-bl-md border border-border/50'
        }`}
      >
        {message.message_type === 'image' && message.file_url && (
          <div className="relative group overflow-hidden rounded-lg mb-1">
            {/* Blur placeholder - shown while image loads */}
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <img
              src={message.file_url}
              alt="shared"
              className={`rounded-lg max-w-full cursor-pointer transition-all duration-500 ${
                imageLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-xl scale-105'
              }`}
              onClick={() => { if (imageLoaded && onImageClick) onImageClick(message.file_url); }}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageLoaded(true);
                setImageError(true);
              }}
            />
            {imageError && (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                Gagal memuat gambar
              </div>
            )}
            <button
              onClick={handleDownloadImage}
              className="absolute bottom-2 right-2 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
            >
              <Download className="w-4 h-4 text-white" />
            </button>
          </div>
        )}

        {message.message_type === 'audio' && message.file_url && (
          <AudioPlayer src={message.file_url} isMine={isMine} title={message.content} />
        )}

        {message.message_type === 'video' && message.file_url && (
          <VideoMessage src={message.file_url} isMine={isMine} />
        )}

        {message.message_type === 'file' && message.file_url && (
          <a
            href={message.file_url}
            target="_blank"
            rel="noreferrer"
            className={`block text-[14px] underline break-words mb-1 ${
              isMine ? 'text-primary-foreground' : 'text-primary'
            }`}
          >
            {message.content || 'Buka file'}
          </a>
        )}

        {message.content && message.message_type !== 'image' && (
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
            {renderTextWithLinks(message.content, isMine)}
          </p>
        )}

        {/* Link preview card */}
        {message.message_type !== 'image' && extractUrls(message.content).map((url, i) => (
          <LinkPreview key={i} url={url} isMine={isMine} />
        ))}

        <div className={`flex items-center gap-1 justify-end mt-0.5 ${
          isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'
        }`}>
          <span className="text-[10px]">{time}</span>
          {isMine && (
            <>
              {isRead ? (
                <CheckCheck className="w-3.5 h-3.5 text-black" />
              ) : isReceived ? (
                <CheckCheck className="w-3.5 h-3.5" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}