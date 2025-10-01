(() => {
    const sealStorageKey = 'sealImage';
    const sealNameStorageKey = 'sealFileName';
    let storage;
    try {
        storage = window.sessionStorage;
    } catch (error) {
        storage = {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        };
    }

    const sealDropzone = document.getElementById('seal-dropzone');
    const invoiceDropzone = document.getElementById('invoice-dropzone');
    const sealInput = document.getElementById('seal-input');
    const invoiceInput = document.getElementById('invoice-input');
    const sealPreview = document.getElementById('seal-preview');
    const sealIcon = document.getElementById('seal-icon');
    const sealStatus = document.getElementById('seal-status');
    const sealFilename = document.getElementById('seal-filename');
    const invoiceStatus = document.getElementById('invoice-status');
    const invoiceFilename = document.getElementById('invoice-filename');
    const invoiceWarning = document.getElementById('invoice-warning');
    const downloadCard = document.getElementById('download-card');
    const downloadButton = document.getElementById('download-button');
    const clearButton = document.getElementById('clear-button');
    const errorMessage = document.getElementById('error-message');
    const loadingIndicator = document.getElementById('loading-indicator');
    const canvasElement = document.getElementById('editor-canvas');
    const canvasPlaceholder = document.getElementById('canvas-placeholder');
    const canvasHelper = document.getElementById('canvas-helper');

    const canvas = canvasElement;
    const ctx = canvas.getContext('2d');

    const RESIZE_HANDLE_SIZE = 14;
    const MIN_SEAL_SIZE = 24;

    let isLoading = false;
    let invoiceImageData = null;
    let sealImageData = null;
    let sealFileName = '';
    let invoiceFileName = '';

    let invoiceImage = null;
    let sealImage = null;

    let sealTransform = { x: 50, y: 50, width: 150, height: 150 };
    let isDragging = false;
    let isResizing = null;
    let dragStart = { x: 0, y: 0 };
    let lastCanvasSize = { width: 0, height: 0 };

    const hasPdfLib = () => typeof window.pdfjsLib !== 'undefined';

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
    }

    function clearError() {
        errorMessage.hidden = true;
        errorMessage.textContent = '';
    }

    function setLoading(state) {
        isLoading = state;
        loadingIndicator.hidden = !state;
        sealDropzone.classList.toggle('disabled', state);
        invoiceDropzone.classList.toggle('disabled', state || !sealImageData);
        sealInput.disabled = state;
        invoiceInput.disabled = state || !sealImageData;
        downloadButton.disabled = state || !invoiceImage || !sealImage;
        toggleInvoiceAvailability();
    }

    function toggleInvoiceAvailability() {
        const enabled = Boolean(sealImageData) && !isLoading;
        invoiceDropzone.classList.toggle('disabled', !enabled);
        invoiceDropzone.setAttribute('aria-disabled', (!enabled).toString());
        invoiceInput.disabled = !enabled;
        invoiceWarning.hidden = enabled;
    }

    function updateDownloadSection() {
        const ready = Boolean(invoiceImage && sealImage);
        downloadCard.hidden = !ready;
        downloadButton.disabled = !ready || isLoading;
    }

    function updateSealPreview() {
        if (sealImageData) {
            sealPreview.src = sealImageData;
            sealPreview.hidden = false;
            sealIcon.classList.add('hidden');
            sealStatus.textContent = 'تم رفع الصورة بنجاح!';
            sealFilename.textContent = sealFileName;
            sealFilename.hidden = !sealFileName;
        } else {
            sealPreview.hidden = true;
            sealIcon.classList.remove('hidden');
            sealStatus.textContent = 'ارفع صورة الختم';
            sealFilename.hidden = true;
        }
    }

    function updateInvoiceStatus() {
        if (invoiceImageData) {
            invoiceStatus.textContent = 'تم رفع المستند بنجاح!';
            invoiceFilename.textContent = invoiceFileName;
            invoiceFilename.hidden = !invoiceFileName;
            canvasPlaceholder.classList.add('hidden');
            canvasHelper.classList.add('visible');
        } else {
            invoiceStatus.textContent = 'ارفع الفاتورة أو المستند';
            invoiceFilename.hidden = true;
            canvasPlaceholder.classList.remove('hidden');
            canvasHelper.classList.remove('visible');
            clearCanvas();
        }
    }

    function clearCanvas() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function fitCanvas() {
        const parent = canvas.parentElement;
        if (!parent) return;
        const newWidth = parent.clientWidth;
        const newHeight = parent.clientHeight;
        if (newWidth === canvas.width && newHeight === canvas.height) return;

        if (lastCanvasSize.width && lastCanvasSize.height) {
            const scaleX = newWidth / lastCanvasSize.width;
            const scaleY = newHeight / lastCanvasSize.height;
            sealTransform = {
                x: sealTransform.x * scaleX,
                y: sealTransform.y * scaleY,
                width: sealTransform.width * scaleX,
                height: sealTransform.height * scaleY,
            };
        }

        canvas.width = newWidth;
        canvas.height = newHeight;
        lastCanvasSize = { width: newWidth, height: newHeight };
    }

    function getResizeHandles(transform) {
        return {
            'top-left': { x: transform.x, y: transform.y },
            'top-right': { x: transform.x + transform.width, y: transform.y },
            'bottom-left': { x: transform.x, y: transform.y + transform.height },
            'bottom-right': { x: transform.x + transform.width, y: transform.y + transform.height },
        };
    }

    function draw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!invoiceImage) return;

        const canvasAspectRatio = canvas.width / canvas.height;
        const invoiceAspectRatio = invoiceImage.width / invoiceImage.height;

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

        ctx.drawImage(invoiceImage, offsetX, offsetY, drawWidth, drawHeight);

        if (!sealImage) return;

        ctx.drawImage(sealImage, sealTransform.x, sealTransform.y, sealTransform.width, sealTransform.height);

        ctx.strokeStyle = '#0d9488';
        ctx.lineWidth = 2;
        ctx.strokeRect(sealTransform.x, sealTransform.y, sealTransform.width, sealTransform.height);

        ctx.fillStyle = '#14b8a6';
        const handles = getResizeHandles(sealTransform);
        Object.values(handles).forEach(handle => {
            ctx.fillRect(handle.x - RESIZE_HANDLE_SIZE / 2, handle.y - RESIZE_HANDLE_SIZE / 2, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE);
        });
    }

    function processImageData(imageData) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('تعذر تحميل الصورة.'));
            img.src = imageData;
        });
    }

    async function loadSealImage(dataUrl) {
        sealImageData = dataUrl;
        storage.setItem(sealStorageKey, dataUrl);
        if (sealFileName) {
            storage.setItem(sealNameStorageKey, sealFileName);
        }
        sealImage = await processImageData(dataUrl);
        const aspectRatio = sealImage.width / sealImage.height || 1;
        sealTransform.width = Math.min(canvas.width * 0.3, 180);
        sealTransform.height = sealTransform.width / aspectRatio;
        sealTransform.x = canvas.width * 0.05;
        sealTransform.y = canvas.height * 0.05;
        updateSealPreview();
        toggleInvoiceAvailability();
        draw();
        updateDownloadSection();
    }

    async function loadInvoiceImage(dataUrl) {
        invoiceImageData = dataUrl;
        invoiceImage = await processImageData(dataUrl);
        canvasPlaceholder.classList.add('hidden');
        canvasHelper.classList.add('visible');
        draw();
    }

    async function processFile(file) {
        if (file.type.startsWith('image/')) {
            return await readFileAsDataUrl(file);
        }
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            if (!hasPdfLib()) {
                throw new Error('مكتبة PDF غير محملة. يرجى التحقق من اتصالك بالإنترنت.');
            }
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2 });
            const renderCanvas = document.createElement('canvas');
            renderCanvas.width = viewport.width;
            renderCanvas.height = viewport.height;
            const renderContext = renderCanvas.getContext('2d');
            if (!renderContext) {
                throw new Error('فشل في إنشاء سياق الكانفاس.');
            }
            await page.render({ canvasContext: renderContext, viewport }).promise;
            return renderCanvas.toDataURL('image/png');
        }
        throw new Error('صيغة الملف غير مدعومة. يرجى رفع صورة أو ملف PDF.');
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('تعذر قراءة الملف.'));
            reader.readAsDataURL(file);
        });
    }

    async function handleSealFile(file) {
        if (!file) return;
        setLoading(true);
        clearError();
        try {
            const dataUrl = await processFile(file);
            sealFileName = file.name;
            await loadSealImage(dataUrl);
        } catch (error) {
            console.error(error);
            showError(error.message || 'حدث خطأ أثناء معالجة الملف.');
        } finally {
            setLoading(false);
        }
    }

    async function handleInvoiceFile(file) {
        if (!file || !sealImageData) return;
        setLoading(true);
        clearError();
        try {
            const dataUrl = await processFile(file);
            invoiceFileName = file.name;
            await loadInvoiceImage(dataUrl);
            updateInvoiceStatus();
            updateDownloadSection();
        } catch (error) {
            console.error(error);
            showError(error.message || 'حدث خطأ أثناء معالجة الملف.');
        } finally {
            setLoading(false);
        }
    }

    function setupDropzone(dropzone, input, { onFile, disabledChecker }) {
        const isDisabled = () => disabledChecker?.() ?? input.disabled;

        dropzone.addEventListener('click', () => {
            if (isDisabled()) return;
            input.click();
        });

        dropzone.addEventListener('keydown', (event) => {
            if ((event.key === 'Enter' || event.key === ' ') && !isDisabled()) {
                event.preventDefault();
                input.click();
            }
        });

        dropzone.addEventListener('dragover', (event) => {
            event.preventDefault();
            if (isDisabled()) return;
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (event) => {
            event.preventDefault();
            dropzone.classList.remove('dragover');
            if (isDisabled()) return;
            const file = event.dataTransfer?.files?.[0];
            if (file) {
                onFile(file);
            }
        });

        input.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (file) {
                onFile(file);
                input.value = '';
            }
        });
    }

    function getPointerPosition(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    }

    function updateCursorStyle(pos) {
        if (!sealImage) {
            canvas.style.cursor = 'default';
            return;
        }
        const handles = getResizeHandles(sealTransform);
        for (const [key, handlePos] of Object.entries(handles)) {
            if (Math.abs(pos.x - handlePos.x) < RESIZE_HANDLE_SIZE && Math.abs(pos.y - handlePos.y) < RESIZE_HANDLE_SIZE) {
                if (key === 'top-left' || key === 'bottom-right') {
                    canvas.style.cursor = 'nwse-resize';
                } else {
                    canvas.style.cursor = 'nesw-resize';
                }
                return;
            }
        }
        const insideSeal = pos.x > sealTransform.x && pos.x < sealTransform.x + sealTransform.width &&
            pos.y > sealTransform.y && pos.y < sealTransform.y + sealTransform.height;
        canvas.style.cursor = insideSeal ? 'grab' : 'default';
    }

    function clampTransform(transform) {
        if (!invoiceImage) return transform;
        transform.width = Math.max(transform.width, MIN_SEAL_SIZE);
        transform.height = Math.max(transform.height, MIN_SEAL_SIZE);
        transform.x = Math.min(Math.max(transform.x, 0), canvas.width - transform.width);
        transform.y = Math.min(Math.max(transform.y, 0), canvas.height - transform.height);
        return transform;
    }

    function handlePointerDown(event) {
        if (!sealImage || !invoiceImage) return;
        const pos = getPointerPosition(event);
        const handles = getResizeHandles(sealTransform);

        for (const [key, handlePos] of Object.entries(handles)) {
            if (Math.abs(pos.x - handlePos.x) < RESIZE_HANDLE_SIZE && Math.abs(pos.y - handlePos.y) < RESIZE_HANDLE_SIZE) {
                isResizing = key;
                dragStart = pos;
                canvas.setPointerCapture(event.pointerId);
                event.preventDefault();
                return;
            }
        }

        if (pos.x > sealTransform.x && pos.x < sealTransform.x + sealTransform.width &&
            pos.y > sealTransform.y && pos.y < sealTransform.y + sealTransform.height) {
            isDragging = true;
            dragStart = { x: pos.x - sealTransform.x, y: pos.y - sealTransform.y };
            canvas.setPointerCapture(event.pointerId);
            event.preventDefault();
        }
    }

    function handlePointerMove(event) {
        const pos = getPointerPosition(event);
        if (!sealImage || !invoiceImage) {
            updateCursorStyle(pos);
            return;
        }

        if (!isDragging && !isResizing) {
            updateCursorStyle(pos);
            return;
        }

        event.preventDefault();
        const newTransform = { ...sealTransform };
        const aspectRatio = sealImage.width / sealImage.height || 1;

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

            dragStart = pos;
        }

        sealTransform = clampTransform(newTransform);
        draw();
    }

    function handlePointerUp(event) {
        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
        isDragging = false;
        isResizing = null;
    }

    function exportImage() {
        if (!invoiceImage || !sealImage) return;

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        tempCanvas.width = invoiceImage.width;
        tempCanvas.height = invoiceImage.height;

        const canvasAspectRatio = canvas.width / canvas.height;
        const invoiceAspectRatio = invoiceImage.width / invoiceImage.height;

        let canvasDrawWidth;
        let canvasDrawHeight;
        let canvasOffsetX;
        let canvasOffsetY;

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

        const finalScaleX = invoiceImage.width / canvasDrawWidth;
        const finalScaleY = invoiceImage.height / canvasDrawHeight;

        const finalX = (sealTransform.x - canvasOffsetX) * finalScaleX;
        const finalY = (sealTransform.y - canvasOffsetY) * finalScaleY;
        const finalWidth = sealTransform.width * finalScaleX;
        const finalHeight = sealTransform.height * finalScaleY;

        tempCtx.drawImage(invoiceImage, 0, 0);
        tempCtx.drawImage(sealImage, finalX, finalY, finalWidth, finalHeight);

        const link = document.createElement('a');
        link.download = 'documento-sellado.png';
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    }

    function clearInvoice() {
        invoiceImageData = null;
        invoiceImage = null;
        invoiceFileName = '';
        setLoading(false);
        updateInvoiceStatus();
        updateDownloadSection();
        toggleInvoiceAvailability();
        if (invoiceInput) {
            invoiceInput.value = '';
        }
    }

    function handleStoredSeal() {
        const stored = storage.getItem(sealStorageKey);
        if (!stored) return;
        sealFileName = storage.getItem(sealNameStorageKey) || 'seal.png';
        sealImageData = stored;
        processImageData(stored).then((img) => {
            sealImage = img;
            updateSealPreview();
            toggleInvoiceAvailability();
            draw();
            updateDownloadSection();
        }).catch(() => {
            storage.removeItem(sealStorageKey);
            storage.removeItem(sealNameStorageKey);
        });
    }

    function initialiseCanvas() {
        fitCanvas();
        clearCanvas();
        window.addEventListener('resize', () => {
            const prevSize = { ...lastCanvasSize };
            fitCanvas();
            if (prevSize.width && prevSize.height) {
                draw();
            }
        });
    }

    setupDropzone(sealDropzone, sealInput, {
        onFile: handleSealFile,
    });

    setupDropzone(invoiceDropzone, invoiceInput, {
        onFile: handleInvoiceFile,
        disabledChecker: () => invoiceInput.disabled,
    });

    downloadButton.addEventListener('click', exportImage);
    clearButton.addEventListener('click', clearInvoice);

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);

    initialiseCanvas();
    handleStoredSeal();
    toggleInvoiceAvailability();
    updateSealPreview();
    updateInvoiceStatus();
})();
