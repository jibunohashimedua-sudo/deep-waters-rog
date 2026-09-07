"use client";
import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { getCroppedBlob } from "@/lib/cropImage";

export default function PhotoCropper({
  src,
  onCancel,
  onSave
}: {
  src: string;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixelCrop, setPixelCrop] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, cropped: Area) => {
    setPixelCrop(cropped);
  }, []);

  async function handleSave() {
    if (!pixelCrop) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(src, pixelCrop, 400);
      onSave(blob);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-rog-line">
          <p className="kicker">Adjust</p>
          <h3 className="mt-1 text-xl font-bold text-rog-purple">
            Your profile photo
          </h3>
          <p className="mt-1 text-xs text-rog-muted">
            Drag to reposition. Pinch or use the slider to zoom.
          </p>
        </div>

        {/* Cropper canvas */}
        <div className="relative w-full h-80 bg-rog-cream">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom slider */}
        <div className="p-5 border-t border-rog-line">
          <label className="flex items-center gap-3">
            <span className="text-xs text-rog-muted font-medium w-10">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-rog-purple"
            />
          </label>
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !pixelCrop}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Use this"}
          </button>
        </div>
      </div>
    </div>
  );
}
