import React, { useState, useRef, useCallback } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import CanvasEditor from './components/CanvasEditor';
import type { CanvasEditorHandle } from './components/CanvasEditor';
import FileUpload from './components/FileUpload';
import { DownloadIcon, SealIcon, InvoiceIcon, LoadingIcon } from './components/IconComponents';

const App: React.FC = () => {
    const [sealImage, setSealImage] = useLocalStorage<string | null>('sealImage', null);
    const [invoiceImage, setInvoiceImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const canvasEditorRef = useRef<CanvasEditorHandle>(null);

    const processFile = async (file: File): Promise<string> => {
        if (file.type.startsWith('image/')) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(file);
            });
        } else if (file.type === 'application/pdf') {
            const pdfjsLib = (window as any).pdfjsLib;
            if (!pdfjsLib) {
                throw new Error('مكتبة PDF غير محملة. يرجى التحقق من اتصالك بالإنترنت.');
            }
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (context) {
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                return canvas.toDataURL('image/png');
            } else {
                 throw new Error('فشل في إنشاء سياق الكانفاس.');
            }
        } else {
            throw new Error('صيغة الملف غير مدعومة. يرجى رفع صورة أو ملف PDF.');
        }
    };

    const handleFileChange = useCallback(async (file: File | null, type: 'seal' | 'invoice') => {
        if (!file) return;

        setIsLoading(true);
        setError(null);
        try {
            const imageDataUrl = await processFile(file);
            if (type === 'seal') {
                setSealImage(imageDataUrl);
            } else {
                setInvoiceImage(imageDataUrl);
            }
        } catch (err: any) {
            setError(err.message || 'حدث خطأ أثناء معالجة الملف.');
        } finally {
            setIsLoading(false);
        }
    }, [setSealImage]);

    const handleDownload = () => {
        if (canvasEditorRef.current) {
            canvasEditorRef.current.exportImage();
        }
    };
    
    const clearInvoice = () => {
        setInvoiceImage(null);
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <header className="bg-gray-800 shadow-lg p-4">
                <h1 className="text-3xl font-bold text-center text-teal-400">تطبيق ختم المستندات</h1>
                <p className="text-center text-gray-400 mt-1">أضف ختمك الرقمي على الفواتير والمستندات بسهولة</p>
            </header>

            <main className="p-4 sm:p-8">
                {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-lg mb-6 text-center">{error}</div>}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Controls Column */}
                    <div className="lg:col-span-4 xl:col-span-3 bg-gray-800 p-6 rounded-xl shadow-2xl space-y-8">
                        <div>
                            <h2 className="text-xl font-semibold mb-4 border-b-2 border-teal-500 pb-2 flex items-center gap-2"><SealIcon /> الخطوة 1: إعداد الختم</h2>
                            <FileUpload
                                id="seal-upload"
                                label="ارفع صورة الختم"
                                onFileSelect={(file) => handleFileChange(file, 'seal')}
                                previewSrc={sealImage}
                            />
                            <p className="text-xs text-gray-500 mt-2">سيتم حفظ الختم تلقائيًا لاستخدامه في المرات القادمة. يمكنك تغييره في أي وقت برفع صورة جديدة.</p>
                        </div>

                        <div>
                            <h2 className="text-xl font-semibold mb-4 border-b-2 border-teal-500 pb-2 flex items-center gap-2"><InvoiceIcon /> الخطوة 2: رفع المستند</h2>
                             <FileUpload
                                id="invoice-upload"
                                label="ارفع الفاتورة أو المستند"
                                onFileSelect={(file) => handleFileChange(file, 'invoice')}
                                disabled={!sealImage}
                            />
                            {!sealImage && <p className="text-yellow-400 text-sm mt-2">يجب رفع صورة الختم أولاً.</p>}
                        </div>

                        {invoiceImage && (
                             <div>
                                <h2 className="text-xl font-semibold mb-4 border-b-2 border-teal-500 pb-2">الخطوة 3: التنزيل</h2>
                                <button
                                    onClick={handleDownload}
                                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 flex items-center justify-center gap-2 disabled:bg-gray-600 disabled:cursor-not-allowed"
                                    disabled={!invoiceImage || !sealImage || isLoading}
                                >
                                    <DownloadIcon />
                                    تنزيل المستند المختوم
                                </button>
                                <button
                                    onClick={clearInvoice}
                                    className="w-full mt-4 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
                                >
                                    ختم مستند آخر
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* Canvas Column */}
                    <div className="lg:col-span-8 xl:col-span-9 bg-gray-800 p-4 rounded-xl shadow-2xl flex items-center justify-center min-h-[60vh] lg:min-h-0">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center text-gray-400">
                                <LoadingIcon />
                                <p className="mt-4 text-lg animate-pulse">جاري معالجة الملف...</p>
                            </div>
                        ) : invoiceImage && sealImage ? (
                            <CanvasEditor ref={canvasEditorRef} invoiceSrc={invoiceImage} sealSrc={sealImage} />
                        ) : (
                            <div className="text-center text-gray-500">
                                <SealIcon className="w-24 h-24 mx-auto opacity-20" />
                                <h3 className="mt-4 text-2xl font-semibold">مساحة العمل</h3>
                                <p className="mt-2">ارفع الختم والمستند لبدء التعديل.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
