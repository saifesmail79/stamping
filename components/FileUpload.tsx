import React, { useRef, useState } from 'react';
import { UploadIcon } from './IconComponents';

interface FileUploadProps {
    id: string;
    label: string;
    onFileSelect: (file: File | null) => void;
    previewSrc?: string | null;
    disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ id, label, onFileSelect, previewSrc, disabled = false }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onFileSelect(file);
            setFileName(file.name);
        }
    };
    
    const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
    };
    
    const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        if (disabled) return;
        const file = event.dataTransfer.files?.[0];
         if (file) {
            onFileSelect(file);
            setFileName(file.name);
        }
    };

    return (
        <div>
            <label
                htmlFor={id}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg transition-colors duration-300
                ${disabled ? 'bg-gray-800 border-gray-700 cursor-not-allowed' : 'border-gray-600 hover:border-teal-500 hover:bg-gray-700 cursor-pointer'}`}
            >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {previewSrc ? (
                        <img src={previewSrc} alt="Preview" className="max-h-24 object-contain rounded-md mb-2" />
                    ) : (
                        <UploadIcon />
                    )}
                    <p className={`mb-2 text-sm text-center ${previewSrc ? 'text-teal-400' : 'text-gray-400'}`}>
                        {previewSrc ? 'تم رفع الصورة بنجاح!' : label}
                    </p>
                    <p className="text-xs text-gray-500 text-center">
                        {fileName || 'اسحب وأفلت أو انقر للرفع (PDF, PNG, JPG)'}
                    </p>
                </div>
                <input ref={inputRef} id={id} type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} disabled={disabled} />
            </label>
        </div>
    );
};

export default FileUpload;
