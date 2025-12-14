"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { capturePhotoWithOverlay } from "@/lib/photoOverlay";

interface CameraCaptureProps {
  overlayText: string;
  onCapture: (photo: string) => void;
  onCancel: () => void;
}

export default function CameraCapture({
  overlayText,
  onCapture,
  onCancel,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  // Start camera
  useEffect(() => {
    let mounted = true;
    let mediaStream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode, // Dynamic: front or back
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        if (!mounted) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("[CameraCapture] error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์การเข้าถึงกล้อง"
        );
      }
    };

    startCamera();

    return () => {
      mounted = false;
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Handle capture
  const handleCapture = useCallback(async () => {
    if (!videoRef.current || isCapturing) return;

    setIsCapturing(true);

    try {
      const lines = overlayText.split("\n");
      const timestamp = lines[0] || "";
      const location = lines[1] || "";

      const photo = await capturePhotoWithOverlay(videoRef.current, {
        timestamp,
        location,
      });

      stopCamera();
      onCapture(photo);
    } catch (err) {
      console.error("[CameraCapture] capture error:", err);
      setError("ไม่สามารถถ่ายรูปได้ กรุณาลองอีกครั้ง");
      setIsCapturing(false);
    }
  }, [overlayText, onCapture, stopCamera, isCapturing]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    stopCamera();
    onCancel();
  }, [stopCamera, onCancel]);

  // Toggle camera (front/back)
  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Read file as data URL
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageDataUrl = event.target?.result as string;

        // Create image element to draw on canvas
        const img = new Image();
        img.onload = async () => {
          const lines = overlayText.split("\n");
          const timestamp = lines[0] || "";
          const location = lines[1] || "";

          // Draw image to canvas with overlay
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.drawImage(img, 0, 0);

            // Add overlay (same style as camera capture)
            const padding = canvas.width * 0.03;
            const fontSize = Math.max(canvas.width * 0.04, 24);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, canvas.height - (fontSize * 4 + padding * 2), canvas.width, fontSize * 4 + padding * 2);

            ctx.fillStyle = 'white';
            ctx.font = `bold ${fontSize}px Inter, sans-serif`;
            ctx.fillText(timestamp, padding, canvas.height - (fontSize * 2 + padding * 1.5));

            ctx.font = `${fontSize * 0.75}px Inter, sans-serif`;
            ctx.fillText(location, padding, canvas.height - padding);

            const photoWithOverlay = canvas.toDataURL('image/jpeg', 0.9);
            stopCamera();
            onCapture(photoWithOverlay);
          }
        };
        img.src = imageDataUrl;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("[CameraCapture] file select error:", err);
      setError("ไม่สามารถโหลดรูปได้ กรุณาลองอีกครั้ง");
    }
  }, [overlayText, onCapture, stopCamera]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCapture();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleCancel, handleCapture]);

  if (error) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              เกิดข้อผิดพลาด
            </h3>
            <p className="text-sm text-gray-600 mb-6">{error}</p>
            <button
              onClick={handleCancel}
              className="w-full px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      {/* Video preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay preview */}
      <div className="absolute bottom-32 left-0 right-0 px-6 pointer-events-none">
        <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 rounded-t-3xl">
          {overlayText.split("\n").map((line, i) => (
            <div
              key={i}
              className={`text-white ${
                i === 0
                  ? "text-2xl sm:text-3xl font-bold mb-1"
                  : "text-lg sm:text-xl"
              }`}
              style={{
                textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 bg-gradient-to-t from-black/90 to-transparent">
        {/* Top Row: Switch Camera + Choose File */}
        <div className="flex items-center justify-center gap-3 mb-4">
          {/* Switch Camera Button */}
          <button
            onClick={toggleCamera}
            disabled={isCapturing}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl font-medium backdrop-blur-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            สลับกล้อง
          </button>

          {/* Choose from Gallery Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isCapturing}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl font-medium backdrop-blur-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            เลือกรูป
          </button>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-center gap-6">
          {/* Cancel button */}
          <button
            onClick={handleCancel}
            disabled={isCapturing}
            className="px-6 py-3 bg-red-600/90 hover:bg-red-600 text-white rounded-2xl font-semibold backdrop-blur-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            ยกเลิก
          </button>

          {/* Capture button */}
          <button
            onClick={handleCapture}
            disabled={isCapturing}
            className="w-20 h-20 bg-white rounded-full border-4 border-blue-500 shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isCapturing ? (
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <div className="w-14 h-14 bg-blue-500 rounded-full" />
            )}
          </button>

          {/* Spacer for symmetry */}
          <div className="w-24" />
        </div>

        {/* Hint text */}
        <div className="mt-4 text-center text-white/80 text-sm">
          <p>กดปุ่มวงกลมเพื่อถ่ายรูป หรือกด Enter/Space</p>
          <p className="text-xs mt-1 text-white/60">สลับกล้อง • เลือกรูป • Esc ยกเลิก</p>
        </div>
      </div>

      {/* Loading indicator */}
      {!stream && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white text-lg">กำลังเปิดกล้อง...</p>
          </div>
        </div>
      )}
    </div>
  );
}
