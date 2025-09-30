import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import type { SealTransform } from '../types';

interface CanvasEditorProps {
    invoiceSrc: string;
    sealSrc: string;
}

export interface CanvasEditorHandle {
    exportImage: () => void;
}

const RESIZE_HANDLE_SIZE = 10;
const MIN_SEAL_SIZE = 20;

const CanvasEditor = forwardRef<CanvasEditorHandle, CanvasEditorProps>(({ invoiceSrc, sealSrc }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [invoiceImg, setInvoiceImg] = useState<HTMLImageElement | null>(null);
    const [sealImg, setSealImg] = useState<HTMLImageElement | null>(null);
    const [sealTransform, setSealTransform] = useState<SealTransform>({ x: 50, y: 50, width: 150, height: 150 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState<string | null>(null); // e.g., 'bottom-right'
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const img = new Image();
        img.src = invoiceSrc;
        img.onload = () => setInvoiceImg(img);
    }, [invoiceSrc]);

    useEffect(() => {
        const img = new Image();
        img.src = sealSrc;
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          setSealTransform(prev => ({...prev, height: prev.width / aspectRatio }));
          setSealImg(img);
        };
    }, [sealSrc]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas || !invoiceImg || !sealImg) return;
        
        // Fit invoice to canvas size
        const canvasAspectRatio = canvas.width / canvas.height;
        const invoiceAspectRatio = invoiceImg.width / invoiceImg.height;
        let drawWidth, drawHeight, offsetX, offsetY;

        if (invoiceAspectRatio > canvasAspectRatio) {
            drawWidth = canvas.width;
            drawHeight = canvas.width / invoiceAspectRatio;
            offsetX = 0;
            offsetY = (canvas.height - drawHeight) / 2;
        } else {
            drawHeight = canvas.height;
            drawWidth = canvas.height * invoiceAspectRatio;
            offsetY = 0;
            offsetX = (canvas.width - drawWidth) / 2;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(invoiceImg, offsetX, offsetY, drawWidth, drawHeight);
        ctx.drawImage(sealImg, sealTransform.x, sealTransform.y, sealTransform.width, sealTransform.height);

        // Draw resize handles
        ctx.strokeStyle = '#0d9488';
        ctx.lineWidth = 2;
        ctx.strokeRect(sealTransform.x, sealTransform.y, sealTransform.width, sealTransform.height);
        
        ctx.fillStyle = '#14b8a6';
        const handles = getResizeHandles(sealTransform);
        Object.values(handles).forEach(handle => {
            ctx.fillRect(handle.x - RESIZE_HANDLE_SIZE / 2, handle.y - RESIZE_HANDLE_SIZE / 2, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE);
        });

    }, [invoiceImg, sealImg, sealTransform]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
            }
        }
        draw();
    }, [draw, invoiceImg, sealImg]);
    
    useEffect(() => {
        const handleResize = () => {
             const canvas = canvasRef.current;
            if(canvas && canvas.parentElement) {
                canvas.width = canvas.parentElement.clientWidth;
                canvas.height = canvas.parentElement.clientHeight;
                draw();
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [draw]);

    const getResizeHandles = (transform: SealTransform) => {
        return {
            'top-left': { x: transform.x, y: transform.y },
            'top-right': { x: transform.x + transform.width, y: transform.y },
            'bottom-left': { x: transform.x, y: transform.y + transform.height },
            'bottom-right': { x: transform.x + transform.width, y: transform.y + transform.height },
        };
    };

    const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = getMousePos(e);
        
        // Check for resize
        const handles = getResizeHandles(sealTransform);
        for (const [key, handlePos] of Object.entries(handles)) {
            if (Math.abs(pos.x - handlePos.x) < RESIZE_HANDLE_SIZE && Math.abs(pos.y - handlePos.y) < RESIZE_HANDLE_SIZE) {
                setIsResizing(key);
                setDragStart(pos);
                return;
            }
        }

        // Check for drag
        if (pos.x > sealTransform.x && pos.x < sealTransform.x + sealTransform.width &&
            pos.y > sealTransform.y && pos.y < sealTransform.y + sealTransform.height) {
            setIsDragging(true);
            setDragStart({ x: pos.x - sealTransform.x, y: pos.y - sealTransform.y });
        }
    };
    
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDragging && !isResizing) return;
        const pos = getMousePos(e);
        const newTransform = { ...sealTransform };
        const aspectRatio = sealImg ? sealImg.width / sealImg.height : 1;


        if (isDragging) {
            newTransform.x = pos.x - dragStart.x;
            newTransform.y = pos.y - dragStart.y;
        } else if (isResizing) {
            const dx = pos.x - dragStart.x;
            const dy = pos.y - dragStart.y;

            if (isResizing.includes('right')) {
                newTransform.width = Math.max(MIN_SEAL_SIZE, sealTransform.width + dx);
            }
            if (isResizing.includes('left')) {
                newTransform.width = Math.max(MIN_SEAL_SIZE, sealTransform.width - dx);
                newTransform.x = sealTransform.x + dx;
            }
             if (isResizing.includes('bottom')) {
                newTransform.height = Math.max(MIN_SEAL_SIZE / aspectRatio, sealTransform.height + dy);
            }
            if (isResizing.includes('top')) {
                newTransform.height = Math.max(MIN_SEAL_SIZE / aspectRatio, sealTransform.height - dy);
                newTransform.y = sealTransform.y + dy;
            }
            
            if (isResizing.includes('right') || isResizing.includes('left')) {
              newTransform.height = newTransform.width / aspectRatio;
            } else if (isResizing.includes('bottom') || isResizing.includes('top')) {
              newTransform.width = newTransform.height * aspectRatio;
            }

            setDragStart(pos);
        }
        setSealTransform(newTransform);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(null);
    };

    useImperativeHandle(ref, () => ({
        exportImage: () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!ctx || !canvas || !invoiceImg || !sealImg) return;

            // Perform a final high-quality render on a temporary canvas
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = invoiceImg.width;
            tempCanvas.height = invoiceImg.height;

            if (!tempCtx) return;

            // Scale seal transform to original invoice dimensions
            const scaleX = invoiceImg.width / canvas.width;
            const scaleY = invoiceImg.height / canvas.height;
             let canvasDrawWidth, canvasDrawHeight, canvasOffsetX, canvasOffsetY;

            const canvasAspectRatio = canvas.width / canvas.height;
            const invoiceAspectRatio = invoiceImg.width / invoiceImg.height;

            if (invoiceAspectRatio > canvasAspectRatio) {
                canvasDrawWidth = canvas.width;
                canvasDrawHeight = canvas.width / invoiceAspectRatio;
                canvasOffsetX = 0;
                canvasOffsetY = (canvas.height - canvasDrawHeight) / 2;
            } else {
                canvasDrawHeight = canvas.height;
                canvasDrawWidth = canvas.height * invoiceAspectRatio;
                canvasOffsetY = 0;
                canvasOffsetX = (canvas.width - canvasDrawWidth) / 2;
            }
            
            const finalScaleX = invoiceImg.width / canvasDrawWidth;
            const finalScaleY = invoiceImg.height / canvasDrawHeight;

            const finalX = (sealTransform.x - canvasOffsetX) * finalScaleX;
            const finalY = (sealTransform.y - canvasOffsetY) * finalScaleY;
            const finalWidth = sealTransform.width * finalScaleX;
            const finalHeight = sealTransform.height * finalScaleY;

            tempCtx.drawImage(invoiceImg, 0, 0);
            tempCtx.drawImage(sealImg, finalX, finalY, finalWidth, finalHeight);

            const link = document.createElement('a');
            link.download = 'documento-sellado.png';
            link.href = tempCanvas.toDataURL('image/png');
            link.click();
        }
    }));
    
    const cursorStyle = () => {
        if (isDragging) return 'grabbing';
        if (isResizing) {
            if (isResizing === 'top-left' || isResizing === 'bottom-right') return 'nwse-resize';
            if (isResizing === 'top-right' || isResizing === 'bottom-left') return 'nesw-resize';
        }
        return 'grab';
    };

    return (
        <div className="w-full h-full flex items-center justify-center relative bg-gray-700 rounded-lg overflow-hidden">
            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: cursorStyle() }}
                className="max-w-full max-h-full object-contain"
            />
             <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                اسحب الختم لتغيير مكانه، أو اسحب الزوايا لتغيير حجمه
            </div>
        </div>
    );
});

export default CanvasEditor;
