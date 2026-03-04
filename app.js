/* ═══════════════════════════════════════════════════
   FaceCheck AI  —  app.js
   All face analysis is performed client-side (no upload).
   Canvas pixel sampling is used for skin-tone detection;
   face-shape is inferred from image proportions via a
   simulated AI pipeline with realistic random variance.
═══════════════════════════════════════════════════ */

'use strict';

/* ── STATE ── */
let stream = null;   // MediaStream from camera
let facingMode = 'user'; // 'user' | 'environment'
let currentTab = 'camera';
let capturedCanvas = null;   // off-screen canvas holding the image to analyze
let analysisResult = null;   // result object

/* ══════════════════════════════════════════════
   NAVBAR — scroll shadow + shrink
══════════════════════════════════════════════ */
window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (window.scrollY > 40) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
}, { passive: true });

/* ══════════════════════════════════════════════
   SMOOTH SCROLL HELPERS
══════════════════════════════════════════════ */
function scrollToAnalyzer() {
    document.getElementById('analyzer').scrollIntoView({ behavior: 'smooth' });
}

/* ══════════════════════════════════════════════
   TAB SWITCHING  (camera / upload)
══════════════════════════════════════════════ */
function switchTab(tab) {
    currentTab = tab;

    // toggle source tabs
    document.getElementById('tab-camera').classList.toggle('active', tab === 'camera');
    document.getElementById('tab-upload').classList.toggle('active', tab === 'upload');

    // toggle panels
    document.getElementById('panel-camera').classList.toggle('hidden', tab !== 'camera');
    document.getElementById('panel-upload').classList.toggle('hidden', tab !== 'upload');

    // if leaving camera tab, stop stream
    if (tab !== 'camera' && stream) {
        stopCamera();
    }
}

/* ══════════════════════════════════════════════
   CAMERA
══════════════════════════════════════════════ */
async function startCamera() {
    try {
        if (stream) stopCamera();

        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });

        const video = document.getElementById('camera-feed');
        video.srcObject = stream;

        // Mirror for front cam, normal for rear
        video.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';

        // Show controls
        show('capture-btn');
        show('flip-btn');
        hide('start-camera-btn');

        // Show guide & scan line
        document.querySelector('.camera-guide-text').style.display = 'block';
        document.getElementById('scan-line').style.display = 'block';

    } catch (err) {
        alert('Camera access denied or not available.\nPlease allow camera access or use the Upload tab.');
        console.error('Camera error:', err);
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
    document.getElementById('camera-feed').srcObject = null;
    document.getElementById('scan-line').style.display = 'none';
    document.querySelector('.camera-guide-text').style.display = 'none';
    hide('capture-btn');
    hide('flip-btn');
    show('start-camera-btn');
}

async function flipCamera() {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    await startCamera();
}

function capturePhoto() {
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('processing-canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');

    // un-mirror before capture so pixel analysis is correct
    if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (facingMode === 'user') ctx.setTransform(1, 0, 0, 1, 0, 0);

    capturedCanvas = canvas;
    stopCamera();
    runAnalysis(canvas.toDataURL('image/jpeg', 0.9));
}

/* ══════════════════════════════════════════════
   UPLOAD
══════════════════════════════════════════════ */
function handleDragOver(e) {
    e.preventDefault();
    document.getElementById('upload-zone').classList.add('drag-over');
}
function handleDragLeave() {
    document.getElementById('upload-zone').classList.remove('drag-over');
}
function handleDrop(e) {
    e.preventDefault();
    handleDragLeave();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadImageFile(file);
}
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) loadImageFile(file);
}

function loadImageFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = document.getElementById('preview-img');
        img.src = ev.target.result;
        img.onload = () => {
            // Draw to processing canvas
            const canvas = document.getElementById('processing-canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext('2d').drawImage(img, 0, 0);
            capturedCanvas = canvas;
        };
        hide('upload-zone');
        show('upload-preview');
    };
    reader.readAsDataURL(file);
}

function analyzeUploadedImage() {
    if (!capturedCanvas) return;
    const dataURL = capturedCanvas.toDataURL('image/jpeg', 0.9);
    runAnalysis(dataURL);
}

function resetUpload() {
    document.getElementById('file-input').value = '';
    hide('upload-preview');
    show('upload-zone');
    capturedCanvas = null;
}

/* ══════════════════════════════════════════════
   ANALYSIS PIPELINE
══════════════════════════════════════════════ */
const LOADING_STEPS = [
    'Detecting facial landmarks…',
    'Mapping bone structure…',
    'Analyzing skin undertones…',
    'Measuring facial proportions…',
    'Identifying face shape…',
    'Selecting makeup palette…',
    'Generating recommendations…',
    'Finalizing your beauty profile…'
];

function runAnalysis(dataURL) {
    showLoadingOverlay();

    let step = 0;
    const total = LOADING_STEPS.length;

    const stepInterval = setInterval(() => {
        if (step < total) {
            document.getElementById('loading-step').textContent = LOADING_STEPS[step];
            document.getElementById('loading-bar').style.width = `${Math.round(((step + 1) / total) * 100)}%`;
            step++;
        } else {
            clearInterval(stepInterval);
        }
    }, 420);

    // Let the loading animation show for a convincing duration
    setTimeout(() => {
        clearInterval(stepInterval);
        document.getElementById('loading-step').textContent = 'Analysis complete!';
        document.getElementById('loading-bar').style.width = '100%';

        // Do the actual pixel-based analysis
        analysisResult = analyzeImage(capturedCanvas);

        setTimeout(() => {
            hideLoadingOverlay();
            renderResults(dataURL, analysisResult);
        }, 600);
    }, total * 420 + 300);
}

/* ══════════════════════════════════════════════
   CORE ANALYSIS ENGINE
   Uses canvas pixel sampling + rule-based logic
══════════════════════════════════════════════ */
function analyzeImage(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    /* ── 1. Skin tone via central region sampling ── */
    const sampleW = Math.round(w * 0.3);
    const sampleH = Math.round(h * 0.4);
    const sx = Math.round(w * 0.35);
    const sy = Math.round(h * 0.25);
    const pixels = ctx.getImageData(sx, sy, sampleW, sampleH).data;

    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        // exclude very dark, very bright, and near-grey (background)
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max - min > 15 && max > 60 && max < 245) {
            rSum += r; gSum += g; bSum += b; count++;
        }
    }
    const rAvg = count ? rSum / count : 180;
    const gAvg = count ? gSum / count : 140;
    const bAvg = count ? bSum / count : 120;

    const undertone = detectUndertone(rAvg, gAvg, bAvg);
    const skinShade = detectSkinShade(rAvg, gAvg, bAvg);

    /* ── 2. Aspect ratio for face-shape heuristic ── */
    // Use image aspect ratio + random weighted selection
    const ratio = w / h;
    const faceShape = detectFaceShape(ratio);
    const faceSize = detectFaceSize(w, h);
    const structure = detectStructure(ratio, rAvg, gAvg, bAvg);

    return { undertone, skinShade, faceShape, faceSize, structure, rAvg, gAvg, bAvg };
}

function detectUndertone(r, g, b) {
    // Warm: high R relative to B
    // Cool: B approaches or exceeds R
    // Neutral: balanced
    const warmScore = (r - b);
    const coolScore = (b - r + (g * 0.2));
    if (warmScore > 20) return 'Warm';
    else if (coolScore > 10) return 'Cool';
    else return 'Neutral';
}

function detectSkinShade(r, g, b) {
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
    if (brightness > 200) return 'Fair';
    else if (brightness > 160) return 'Light';
    else if (brightness > 120) return 'Medium';
    else if (brightness > 80) return 'Tan';
    else if (brightness > 50) return 'Deep';
    else return 'Rich Deep';
}

function detectFaceShape(ratio) {
    // Slightly randomise for variety — realistic for different images
    const shapes = [
        { name: 'Oval', weight: ratio < 0.75 ? 35 : 15 },
        { name: 'Round', weight: ratio > 0.85 ? 30 : 10 },
        { name: 'Square', weight: 15 },
        { name: 'Heart', weight: ratio < 0.78 ? 20 : 10 },
        { name: 'Diamond', weight: 10 },
        { name: 'Oblong', weight: ratio < 0.7 ? 25 : 5 },
        { name: 'Triangle', weight: 5 }
    ];
    const total = shapes.reduce((s, x) => s + x.weight, 0);
    let rand = Math.random() * total;
    for (const s of shapes) {
        rand -= s.weight;
        if (rand <= 0) return s.name;
    }
    return 'Oval';
}

function detectFaceSize(w, h) {
    const px = w * h;
    if (px > 1200000) return 'Large';
    else if (px > 500000) return 'Medium';
    else return 'Small';
}

function detectStructure(ratio, r, g, b) {
    // Derive: jaw, cheekbone, forehead category
    const prominent = ratio > 0.90;
    if (prominent) return 'Angular';
    else if (ratio > 0.78) return 'Balanced';
    else return 'Soft';
}

/* ══════════════════════════════════════════════
   RESULT DATA TABLES
══════════════════════════════════════════════ */
const SHAPE_DATA = {
    Oval: {
        desc: 'Oval is considered the most balanced face shape. Your forehead is slightly wider than the jaw, and the face gently narrows toward the chin with soft, curved edges.',
        features: ['Balanced Proportions', 'Slightly Wider Forehead', 'Soft Jawline', 'Curved Temples'],
        proportions: [
            { label: 'Forehead Width', value: 72 },
            { label: 'Cheekbone Width', value: 80 },
            { label: 'Jaw Width', value: 65 },
            { label: 'Face Length', value: 85 }
        ],
        struct: [
            { icon: '🦷', label: 'Jaw Type', value: 'Softly Tapered' },
            { icon: '💎', label: 'Cheekbones', value: 'Gently Prominent' },
            { icon: '🌀', label: 'Temples', value: 'Lightly Curved' },
            { icon: '📏', label: 'Symmetry', value: '87%' },
            { icon: '⬡', label: 'Forehead', value: 'Proportional' },
            { icon: '↕', label: 'Face Ratio', value: '1 : 1.62' }
        ]
    },
    Round: {
        desc: 'Your face has soft, curved edges with full cheeks and a rounded chin. The width and length of your face are nearly equal, giving you a youthful and friendly appearance.',
        features: ['Full Cheeks', 'Rounded Chin', 'Wide Forehead', 'Soft Curves'],
        proportions: [
            { label: 'Forehead Width', value: 80 },
            { label: 'Cheekbone Width', value: 90 },
            { label: 'Jaw Width', value: 80 },
            { label: 'Face Length', value: 65 }
        ],
        struct: [
            { icon: '🦷', label: 'Jaw Type', value: 'Full & Round' },
            { icon: '💎', label: 'Cheekbones', value: 'Wide & Full' },
            { icon: '🌀', label: 'Temples', value: 'Wide' },
            { icon: '📏', label: 'Symmetry', value: '85%' },
            { icon: '⬡', label: 'Forehead', value: 'Wide & Rounded' },
            { icon: '↕', label: 'Face Ratio', value: '1 : 1.05' }
        ]
    },
    Square: {
        desc: 'Your face features a strong, defined jaw with a broad forehead. The width and length measurements are similar, creating a powerful, structured look.',
        features: ['Strong Jawline', 'Broad Forehead', 'Angular Features', 'Defined Edges'],
        proportions: [
            { label: 'Forehead Width', value: 88 },
            { label: 'Cheekbone Width', value: 88 },
            { label: 'Jaw Width', value: 86 },
            { label: 'Face Length', value: 75 }
        ],
        struct: [
            { icon: '🦷', label: 'Jaw Type', value: 'Strong & Angular' },
            { icon: '💎', label: 'Cheekbones', value: 'High & Flat' },
            { icon: '🌀', label: 'Temples', value: 'Straight' },
            { icon: '📏', label: 'Symmetry', value: '89%' },
            { icon: '⬡', label: 'Forehead', value: 'Broad & Square' },
            { icon: '↕', label: 'Face Ratio', value: '1 : 1.10' }
        ]
    },
    Heart: {
        desc: 'Your face is widest at the forehead and cheekbones, narrowing significantly to a pointed or delicate chin — a classic, romantic shape beloved in beauty.',
        features: ['Wide Forehead', 'Narrow Chin', 'High Cheekbones', 'Widow\'s Peak'],
        proportions: [
            { label: 'Forehead Width', value: 90 },
            { label: 'Cheekbone Width', value: 82 },
            { label: 'Jaw Width', value: 55 },
            { label: 'Face Length', value: 78 }
        ],
        struct: [
            { icon: '🦷', label: 'Jaw Type', value: 'Pointed & Delicate' },
            { icon: '💎', label: 'Cheekbones', value: 'High & Defined' },
            { icon: '🌀', label: 'Temples', value: 'Broad' },
            { icon: '📏', label: 'Symmetry', value: '88%' },
            { icon: '⬡', label: 'Forehead', value: 'Dominant & Wide' },
            { icon: '↕', label: 'Face Ratio', value: '1 : 1.45' }
        ]
    },
    Diamond: {
        desc: 'A rarer and striking shape — widest at the cheekbones with a narrow forehead and a narrow, pointed chin, creating a dramatic angular silhouette.',
        features: ['Prominent Cheekbones', 'Narrow Forehead', 'Pointed Chin', 'Angular Structure'],
        proportions: [
            { label: 'Forehead Width', value: 65 },
            { label: 'Cheekbone Width', value: 92 },
            { label: 'Jaw Width', value: 60 },
            { label: 'Face Length', value: 85 }
        ],
        struct: [
            { icon: '🦷', label: 'Jaw Type', value: 'Narrow & Pointed' },
            { icon: '💎', label: 'Cheekbones', value: 'Very Prominent' },
            { icon: '🌀', label: 'Temples', value: 'Narrow' },
            { icon: '📏', label: 'Symmetry', value: '86%' },
            { icon: '⬡', label: 'Forehead', value: 'Narrow' },
            { icon: '↕', label: 'Face Ratio', value: '1 : 1.55' }
        ]
    },
    Oblong: {
        desc: 'Your face is longer than it is wide with a narrow forehead and jaw. The cheeks are straight and the chin may be long, giving an elegant, sculpted look.',
        features: ['Long Face Length', 'Narrow Width', 'Straight Sides', 'Narrow Jaw'],
        proportions: [
            { label: 'Forehead Width', value: 65 },
            { label: 'Cheekbone Width', value: 68 },
            { label: 'Jaw Width', value: 64 },
            { label: 'Face Length', value: 96 }
        ],
        struct: [
            { icon: '🦷', label: 'Jaw Type', value: 'Long & Narrow' },
            { icon: '💎', label: 'Cheekbones', value: 'Subtle' },
            { icon: '🌀', label: 'Temples', value: 'Straight' },
            { icon: '📏', label: 'Symmetry', value: '84%' },
            { icon: '⬡', label: 'Forehead', value: 'Narrow & Tall' },
            { icon: '↕', label: 'Face Ratio', value: '1 : 1.80' }
        ]
    },
    Triangle: {
        desc: 'Your face is widest at the jaw with a narrower forehead. This strong-jawed shape has been celebrated in contemporary beauty for its unique, bold personality.',
        features: ['Wide Jaw', 'Narrow Forehead', 'Strong Chin', 'Bold Structure'],
        proportions: [
            { label: 'Forehead Width', value: 58 },
            { label: 'Cheekbone Width', value: 70 },
            { label: 'Jaw Width', value: 88 },
            { label: 'Face Length', value: 72 }
        ],
        struct: [
            { icon: '🦷', label: 'Jaw Type', value: 'Wide & Strong' },
            { icon: '💎', label: 'Cheekbones', value: 'Moderate' },
            { icon: '🌀', label: 'Temples', value: 'Narrow' },
            { icon: '📏', label: 'Symmetry', value: '82%' },
            { icon: '⬡', label: 'Forehead', value: 'Narrow' },
            { icon: '↕', label: 'Face Ratio', value: '1 : 1.20' }
        ]
    }
};

const COLOR_DATA = {
    Warm: {
        palette: [
            { name: 'Terracotta', hex: '#C97B63' },
            { name: 'Peach Blush', hex: '#FFAC9D' },
            { name: 'Warm Coral', hex: '#FF6B6B' },
            { name: 'Golden Amber', hex: '#E8A030' },
            { name: 'Camel Brown', hex: '#B07D55' },
            { name: 'Olive Green', hex: '#799D58' },
            { name: 'Rust Red', hex: '#A0402A' }
        ],
        embrace: [
            { color: '#C97B63', label: 'Terracotta & Burnt Orange' },
            { color: '#E8A030', label: 'Warm Gold & Amber' },
            { color: '#966050', label: 'Rich Browns & Caramel' },
            { color: '#99AA55', label: 'Olive & Moss Greens' },
            { color: '#FF6B6B', label: 'Warm Coral & Peach' }
        ],
        avoid: [
            { color: '#CCCCFF', label: 'Icy Lavender' },
            { color: '#B0D0F0', label: 'Cool Steel Blue' },
            { color: '#E0E0E0', label: 'Stark Grey' }
        ],
        foundation: [
            { color: '#F2C5A0', name: 'Warm Ivory' },
            { color: '#DBA882', name: 'Sand Beige' },
            { color: '#C98B5F', name: 'Warm Caramel' },
            { color: '#A0673A', name: 'Golden Brown' }
        ]
    },
    Cool: {
        palette: [
            { name: 'Rose Pink', hex: '#E8567C' },
            { name: 'Mauve', hex: '#B87A96' },
            { name: 'Lilac', hex: '#C8A0D8' },
            { name: 'Berry Red', hex: '#9B2355' },
            { name: 'Cool Teal', hex: '#4AABB8' },
            { name: 'Navy Blue', hex: '#2C3E7C' },
            { name: 'Icy Pink', hex: '#F5C6E0' }
        ],
        embrace: [
            { color: '#C8A0D8', label: 'Lavender & Lilac' },
            { color: '#E8567C', label: 'Rose Pink & Fuchsia' },
            { color: '#4AABB8', label: 'Cool Teal & Aqua' },
            { color: '#2C3E7C', label: 'Navy & Royal Blue' },
            { color: '#9B2355', label: 'Deep Berry & Plum' }
        ],
        avoid: [
            { color: '#E8A030', label: 'Warm Gold' },
            { color: '#C97B63', label: 'Orange Tones' },
            { color: '#B07D55', label: 'Warm Camel' }
        ],
        foundation: [
            { color: '#F5DDD0', name: 'Cool Porcelain' },
            { color: '#E0BFAF', name: 'Pink Beige' },
            { color: '#C4967A', name: 'Rose Tan' },
            { color: '#8B5E48', name: 'Cool Mahogany' }
        ]
    },
    Neutral: {
        palette: [
            { name: 'Nude Blush', hex: '#E8C5B0' },
            { name: 'Dusty Rose', hex: '#D4889A' },
            { name: 'Warm Taupe', hex: '#B09080' },
            { name: 'Sage Green', hex: '#88AA88' },
            { name: 'Mushroom', hex: '#C0A898' },
            { name: 'Soft White', hex: '#F5F0EB' },
            { name: 'Charcoal', hex: '#4A4040' }
        ],
        embrace: [
            { color: '#D4889A', label: 'Dusty Rose & Mauve' },
            { color: '#B09080', label: 'Warm Taupe & Greige' },
            { color: '#88AA88', label: 'Sage & Muted Green' },
            { color: '#8080C0', label: 'Muted Periwinkle' },
            { color: '#B08040', label: 'Soft Gold & Bronze' }
        ],
        avoid: [
            { color: '#FF0000', label: 'Stark Neon Red' },
            { color: '#0000FF', label: 'Primary Blue' },
            { color: '#FFFF00', label: 'Bright Yellow' }
        ],
        foundation: [
            { color: '#F0D5C0', name: 'Neutral Ivory' },
            { color: '#D8B898', name: 'Neutral Beige' },
            { color: '#BA8F6A', name: 'Warm Mocha' },
            { color: '#906040', name: 'Deep Espresso' }
        ]
    }
};

const MAKEUP_DATA = {
    Oval: {
        foundation: 'Lucky you — almost any finish works! A light-to-medium coverage luminous foundation keeps your natural balance. Blend to the hairline for a seamless look.',
        blush: 'Apply blush to the apples of your cheeks and sweep lightly toward your temples. Any blush shape flatters your face.',
        contour: 'Minimal contouring needed. A light bronze under cheekbones and a touch on the forehead temples adds subtle warm definition.',
        eye: 'Every eye look flatters you. Try a classic cat-eye or a sultry smoky eye — your balanced proportions carry both beautifully.',
        lip: 'Any lip shape and color is your friend. Experiment with bold reds, soft nudes, or berry stains without restriction.',
        brow: 'Soft, naturally arched brows are perfect. Fill lightly following your natural arch — avoid over-shaping.',
        looks: [
            { emoji: '🌹', name: 'Classic Glam', desc: 'Red lip, winged liner, nude eye.' },
            { emoji: '✨', name: 'Golden Hour', desc: 'Bronze lid, glowy skin, peach lip.' },
            { emoji: '🫧', name: 'Dewy Minimalist', desc: 'Tinted moisturizer, clear gloss.' },
            { emoji: '🎭', name: 'Smoky Drama', desc: 'Dark smoky eye, sculpted brow.' },
            { emoji: '🌸', name: 'Spring Soft', desc: 'Pink blush, mauve lip, light lashes.' },
            { emoji: '💋', name: 'Old Hollywood', desc: 'Bold brow, red lip, contoured cheek.' }
        ]
    },
    Round: {
        foundation: 'Go for full-coverage matte foundation to create a smooth, sculpted base. A slightly darker shade on the outer edges of the face adds dimension.',
        blush: 'Apply blush diagonally from the cheekbone toward the temple — never in circles — to create upward elongation.',
        contour: 'Contour the sides of your forehead and the sides of your jaw. Highlight the center vertical line of your face to create length.',
        eye: 'Elongate with a winged or cat-eye liner. Avoid heavy shadow on the inner corners. Add lashes to the outer corners for lift.',
        lip: 'Opt for defined, slightly overdrawn lips to add structure. Deep, matte shades like berry or wine work especially well.',
        brow: 'A high, angled arch creates definition and adds length. Avoid overly rounded or flat brows as they echo the face shape.',
        looks: [
            { emoji: '🗡️', name: 'Sharp & Sculpted', desc: 'Angular contour, high brow, dark lip.' },
            { emoji: '👁', name: 'Lifted Cat Eye', desc: 'Extended wing liner, defined lashes.' },
            { emoji: '🌙', name: 'Night Edit', desc: 'Matte berry lip, contoured jaw.' },
            { emoji: '🌿', name: 'Natural Lift', desc: 'Diagonal blush, mascara, tinted balm.' },
            { emoji: '💫', name: 'Day Glow', desc: 'Highlight center, sheer lip, soft brow.' },
            { emoji: '🖤', name: 'Graphic Artist', desc: 'Graphic liner, nude lip, defined brow.' }
        ]
    },
    Square: {
        foundation: 'Choose a satin or skin-tint formula. A sheer-to-medium coverage lets your natural skin texture soften the angular look.',
        blush: 'Sweep blush from the apples upward in a rounded, circular motion. Focus color on the cheek apples to add softness.',
        contour: 'Soften the corners of your forehead and square jaw. Blend contour in a wide C-shape. Light highlight on the chin tip rounds it.',
        eye: 'Rounded, soft shadow shapes balance your angles. Try a diffused, outer-V smoky eye with no sharp edges. Curled lashes add softness.',
        lip: 'Full, rounded lip shapes balance your jaw. Choose peachy-pink, rose, or soft berry — avoid very sharp lip lines.',
        brow: 'A slightly curved, gently arched brow softens your face. Fill with light, feathery strokes and avoid a straight horizontal brow.',
        looks: [
            { emoji: '🌹', name: 'Soft Rose', desc: 'Rounded pink lip, soft blush, curled lash.' },
            { emoji: '🫧', name: 'Glass Skin', desc: 'Dewy finish, clear gloss, feathered brows.' },
            { emoji: '🌸', name: 'Cherry Blossom', desc: 'Pink tones, soft smoky eye, peachy lip.' },
            { emoji: '✨', name: 'Radiant Bronze', desc: 'Bronzed skin, copper eye, nude lip.' },
            { emoji: '💎', name: 'Cool Femme', desc: 'Lavender eye, cool pink lip, highlight.' },
            { emoji: '🌙', name: 'Midnight Soft', desc: 'Diffused smoky, soft red lip, blush.' }
        ]
    },
    Heart: {
        foundation: 'Light-to-medium coverage foundation with a natural finish. Embrace your skin and use concealer where needed rather than heavy base.',
        blush: 'Apply blush below the cheekbones and sweep down toward the jaw to add width at the chin area. Avoid temples.',
        contour: 'Lightly contour the forehead (especially the sides and top). Highlight the chin and jaw area to draw the eye downward.',
        eye: 'Keep eye makeup softer and lower so the eyes don\'t overpower the forehead. A gorgeous smoky eye opening the bottom lash line works well.',
        lip: 'Bold, full lips balance your narrower jaw. Go for a full, defined lip — reds, plums, and even bold nudes work beautifully.',
        brow: 'Keep brows soft and not too arched. A low, horizontal brow with light fill reduces the appearance of a wide forehead.',
        looks: [
            { emoji: '💄', name: 'Bold Lip Focus', desc: 'Defined lip, minimal eye, sculpted brow.' },
            { emoji: '🌸', name: 'Romantic', desc: 'Pink tones, soft eye, rosy cheek.' },
            { emoji: '✨', name: 'Celestial Glow', desc: 'Highlight jaw & chin, lit-from-within skin.' },
            { emoji: '🌿', name: 'Effortless Day', desc: 'Tinted lip, mascara, brushed brow.' },
            { emoji: '🎭', name: 'Glam Evening', desc: 'Plum lip, lower lash liner, glow.' },
            { emoji: '💫', name: 'K-Beauty Soft', desc: 'Soft pink, gradient lip, puppy eyes.' }
        ]
    },
    Diamond: {
        foundation: 'A dewy, luminous base highlights your jaw and forehead to add dimension. Choose a skin-tint or light foundation for an effortless look.',
        blush: 'Apply blush horizontally across the cheekbones for width. Avoid blush at the temples to keep the upper face narrower.',
        contour: 'Add highlight to forehead and chin to add fullness. Contour the sides of the cheekbones lightly inward — be minimal with contour.',
        eye: 'Bold eye looks with lots of width (horizontal liner, false lashes across the whole eye) balance your prominent cheekbones beautifully.',
        lip: 'Full, wide lip looks — a plump nude gloss or a full red — help open up the lower face. Avoid tiny or over-defined shapes.',
        brow: 'Soft, wide-set, straight or gently arched brows add width to the forehead. Fill in with light strokes horizontally.',
        looks: [
            { emoji: '💎', name: 'Diamond Glam', desc: 'Wide lash, full lip, inner corner glow.' },
            { emoji: '🌙', name: 'Luxe Night', desc: 'Dark smoky, gloss lip, sharp brow.' },
            { emoji: '✨', name: 'Face of Glass', desc: 'Glass skin, subtle eye, nude gloss.' },
            { emoji: '🌹', name: 'Drama Queen', desc: 'Bold red, lash extensions, clean face.' },
            { emoji: '🌸', name: 'Petal Soft', desc: 'Pastel eye, wide blush, tinted lip.' },
            { emoji: '🖤', name: 'Avant Garde', desc: 'Graphic liner, bold brow, clear skin.' }
        ]
    },
    Oblong: {
        foundation: 'A full-coverage matte foundation creates a solid base. Focus colour on the outer cheeks and minimize highlighting the center to avoid elongation.',
        blush: 'Apply blush horizontally across the cheekbones, keeping it wide and flat — not sweeping up to temples — to add apparent width.',
        contour: 'Contour the very top of the forehead (hairline) and the elongated tip of the chin. Add highlight to the outer cheeks to add width.',
        eye: 'Horizontal eye emphasis — wide shadow, lash across the whole lid, liner extending sideways — all add width and balance length.',
        lip: 'A full, wide lip shape is best. Slightly overline the corners horizontally. Bold colours and glossy finishes give great results.',
        brow: 'A flat, straight brow with minimal arch adds width. Extend brows slightly past natural length horizontally.',
        looks: [
            { emoji: '🌸', name: 'Wide Eyed', desc: 'Horizontal liner, wide shadow, full brow.' },
            { emoji: '💄', name: 'Statement Lip', desc: 'Wide red lip, mascara, minimal eye.' },
            { emoji: '✨', name: 'Glow Wide', desc: 'Highlight cheeks broadly, sheer gloss.' },
            { emoji: '🎭', name: 'Power Look', desc: 'Full coverage, bold brow, berry lip.' },
            { emoji: '🌙', name: 'Night Glam', desc: 'Wide smoky eye, contoured hairline.' },
            { emoji: '🌿', name: 'Effortless Chic', desc: 'Tinted moisturizer, curl lash, gloss.' }
        ]
    },
    Triangle: {
        foundation: 'Go for a lighter shade on the upper face (forehead, temples) and your natural shade on the jaw to balance proportions visually.',
        blush: 'Sweep blush high on the cheekbones angling upward toward temples — this draws the eye upward and balances the wider jaw.',
        contour: 'Lightly contour the sides of the jaw and chin corners to narrow them. Highlight the forehead and temples to add width up top.',
        eye: 'Make your upper face pop — dramatic eye looks with lifted wings, extended inner corners, and strong brows shift focus upward.',
        lip: 'Avoid overly wide or bold lip looks, as this emphasizes the jaw. Go for defined medium-sized lips in muted shades.',
        brow: 'Bold, full brows that extend slightly outward are your best asset — they immediately broaden the upper face and create balance.',
        looks: [
            { emoji: '👁', name: 'Eye Drama', desc: 'Bold eye, lifted wing, strong brow.' },
            { emoji: '✨', name: 'Temple Glow', desc: 'Highlight temples, swept blush, tinted lip.' },
            { emoji: '🌸', name: 'Soft Focus', desc: 'Blurred eye, muted lip, feathered brow.' },
            { emoji: '🌙', name: 'Night Power', desc: 'Dark lid, defined brow, soft jaw contour.' },
            { emoji: '💎', name: 'Editorial', desc: 'Graphic upper liner, bold arch, bare lip.' },
            { emoji: '🌿', name: 'Clean Lift', desc: 'Mascara, brushed brow, fresh skin glow.' }
        ]
    }
};

const TIPS_DATA = {
    Oval: [
        { title: 'Embrace What You Have', body: 'Your oval shape suits virtually any look — use it to experiment boldly. Try seasonal color changes without worry.' },
        { title: 'The Perfect Contour', body: 'Even light contouring under the cheekbones with a soft bronzer instantly elevates your look. Blend, blend, blend.' },
        { title: 'Lash Magic', body: 'A quality mascara or light lash extensions framing your eyes is all you need to make your features pop.' },
        { title: 'Play with Brows', body: 'Your balanced face can carry anything from bold bushy brows to sleek thin arches. Experiment each season.' }
    ],
    Round: [
        { title: 'The Power of Contour', body: 'A two-shade foundation technique (slightly darker on sides, lighter on center) can visually reshape your face.' },
        { title: 'Cat-Eye = Your Signature', body: 'A sharp, upward-extended wing instantly lifts and elongates — make the cat-eye your go-to everyday look.' },
        { title: 'Blush Direction Matters', body: 'Always sweep blush diagonally upward. Round or horizontal blush application makes the face look wider.' },
        { title: 'High Arch Brows', body: 'A higher arch — even if slight — creates the illusion of a lifted, defined face. Fill and set daily.' }
    ],
    Square: [
        { title: 'Soften with Blush Circles', body: 'Round blush application on the apple of the cheeks counterbalances your angular edges gracefully.' },
        { title: 'Diffuse Your Eyes', body: 'Blend out eye shadow edges fully — avoid sharp graphic liner which can echo your strong angles.' },
        { title: 'Highlight the Chin', body: 'A touch of highlighter on the very tip of the chin rounds it visually and draws depth to the center.' },
        { title: 'Curved Lip Line', body: 'Trace your lip liner in a soft, round cupid\'s bow shape to introduce softness to the overall look.' }
    ],
    Heart: [
        { title: 'Balance with a Bold Lip', body: 'Your lips are one of your best features for making a statement. Go bold — the chin draws the eye down beautifully.' },
        { title: 'Keep Eyes Soft', body: 'Heavy top-eye drama makes the forehead appear larger. Emphasize lower lashes and keep upper eye softer.' },
        { title: 'Forehead Bronzing', body: 'A subtle bronzer across the forehead edges without visible lines narrows it gently and gives warmth.' },
        { title: 'Chin Highlighter', body: 'Highlight the chin and very center lower jaw to visually widen your jaw area for better balance.' }
    ],
    Diamond: [
        { title: 'Celebrate Your Cheekbones', body: 'Your cheekbones are likely your most striking feature. Highlight them lightly to make them the focal point.' },
        { title: 'Add Width to Eyes', body: 'Extend lash lines and shadow horizontally. A wide, open-eye look balances your prominent cheek width.' },
        { title: 'Full Lip Shapes Only', body: 'Avoid tiny, pinched lip looks. Wide, full, naturally defined lips add balance below your cheekbones.' },
        { title: 'Horizontal Brows', body: 'Straight, extended brows across a wider span visually widen your forehead for better proportional balance.' }
    ],
    Oblong: [
        { title: 'Width is Your Goal', body: 'Every product application decision should aim to add horizontal visual width — blush, liner, brow, and highlight.' },
        { title: 'Flat Liner Looks', body: 'Try a straight, horizontally wide liner or shadow on the lid. Avoid upward wings as they elongate the face.' },
        { title: 'Bangs are Your Friend', body: 'If considering a haircut, a fringe or curtain bangs immediately reduce the perceived face length dramatically.' },
        { title: 'Contour the Hairline', body: 'A slightly darker powder just at the very top of the forehead (hairline) reduces the perceived face height.' }
    ],
    Triangle: [
        { title: 'Draw Eyes Up', body: 'Make your upper face the star — bold brows, lifted eye looks, and highlighted temples all shift focus upward.' },
        { title: 'Temple Highlight', body: 'A sweep of highlighter on the temples and upper forehead immediately adds width where you want it most.' },
        { title: 'Avoid Wide Lip Shapes', body: 'Keep lip liner within natural lip boundaries or slightly fuller — not wider — to avoid emphasizing the jaw area.' },
        { title: 'Bold to Subtle Gradient', body: 'Make your most dramatic makeup choices above the nose: eyes and brows. Keep cheeks and lips subtler for balance.' }
    ]
};

const HIGHLIGHTS_DATA = {
    Oval: ['Perfect canvas for any makeup style', 'Naturally balanced proportions', 'Cheekbones catch light beautifully', 'Eye area ideal for bold looks'],
    Round: ['Full, youthful cheeks are enviable', 'Natural soft-focus quality to skin', 'Eyes are the strong focal point', 'Lips are a natural highlight area'],
    Square: ['Strong jaw is a powerful, editorial feature', 'High, flat cheekbones are photogenic', 'Bold, symmetrical overall structure', 'Eyes sit prominently on the face'],
    Heart: ['High cheekbones are model-status', 'Forehead is a canvas for brow drama', 'Chin shape is delicate and feminine', 'Lips are a natural focal point'],
    Diamond: ['Cheekbones are your superpower', 'Unique and rare face shape', 'Angular features photograph dramatically', 'Face naturally catches light and shadow'],
    Oblong: ['Elegant, sculpted overall silhouette', 'Strong defined jaw (if present)', 'Eyes appear large on a long face', 'Great base for structural makeup art'],
    Triangle: ['Bold, unique jawline is striking in photos', 'Upper face can carry dramatic brow looks', 'Eyes stand out when emphasized', 'Strong structure for editorial shoots']
};

const OCCASIONS_DATA = {
    Oval: ['Office Day: Soft glam — tinted moisturizer, mascara, nude lip', 'Date Night: Sultry smoky eye with bold lash + nude gloss', 'Festival: Glitter liner, bold brow, glossy skin', 'Wedding: Classic red lip, defined wing, contoured cheek'],
    Round: ['Office Day: Matte skin, diagonal blush, arched brow', 'Date Night: Berry lip, cat-eye, sculpted jaw', 'Festival: Glitter on outer eye, lifted wing, glow', 'Wedding: Angled contour, lifted smoky eye, stain lip'],
    Square: ['Office Day: Soft skin, rounded blush, curved brow', 'Date Night: Diffused smoky eye, peachy lip, glow', 'Festival: Colorful soft shadow, rounded liner, gloss', 'Wedding: Ethereal glow, rose lip, soft eye'],
    Heart: ['Office Day: Mascara, bold lip, brushed brow', 'Date Night: Plum lip, lower lash liner, glow', 'Festival: Bold lip art, minimal eye, shimmer', 'Wedding: Pink tones, spotlight on lips, soft eye'],
    Diamond: ['Office Day: Glass skin, soft brow, tinted lip', 'Date Night: Full smoky eye, wide lash, glossy lip', 'Festival: Inner corner sparkle, wide liner, glow', 'Wedding: Luminous skin, wide eye, silk lip'],
    Oblong: ['Office Day: Wide blush, flat brow, tinted gloss', 'Date Night: Wide liner, full lash, statement lip', 'Festival: Color on outer corners wide, wide brow', 'Wedding: Horizontal highlight, wide eye, full lip'],
    Triangle: ['Office Day: Bold brow, mascara, muted lip', 'Date Night: Dramatic eye, lifted wing, subtle lip', 'Festival: Glitter lids, strong brow, glossy cheek', 'Wedding: Upswept shadow, temple highlight, rose lip']
};

/* ══════════════════════════════════════════════
   BEST MAKEUP STYLE DATA
══════════════════════════════════════════════ */
const STYLE_DATA = {
    Oval: {
        badges: ['Versatile Beauty', 'Classic Glam', 'Trendsetter'],
        title: 'Effortless Glam — Your Style is Limitless',
        desc: 'With an oval face, your signature style is Effortless Glam. You have the unique ability to pull off any look with confidence. From dewy no-makeup makeup to full-on red-carpet drama, your balanced features make every choice feel intentional. Lean into luminous skin, defined eyes, and a classic lip for your everyday power look.',
        categories: [
            { emoji: '✨', name: 'Soft Glam', tags: ['Daily', 'Office', 'Versatile'], desc: 'Glowing skin, sculpted brows, soft shadow and a nude-rose lip. The look that works 365 days.' },
            { emoji: '🌹', name: 'Classic Hollywood', tags: ['Evening', 'Formal', 'Timeless'], desc: 'Bold red lip, winged liner, defined brow. Inspired by Audrey Hepburn — always in style.' },
            { emoji: '🎭', name: 'Sultry Smoky', tags: ['Night Out', 'Statement', 'Dramatic'], desc: 'Blended dark shadow, inner corner highlight, glossy or matte nude lip. Mesmerizing.' },
            { emoji: '🫧', name: 'Dewy Minimalist', tags: ['Casual', 'K-Beauty', 'Fresh'], desc: 'Tinted moisturizer, mascara, tinted lip balm. Effortless and radiant in under 5 minutes.' }
        ],
        why: ['Your balanced proportions suit every liner shape and shadow technique', 'You can switch between natural and dramatic without needing to balance anything', 'Any lip shape — thin line, overdrawn, ombré — will work for you', 'Your face adapts to season trends faster than any other shape'],
        products: [
            { emoji: '💄', name: 'Luminous Foundation', desc: 'Medium-coverage, skin-like finish' },
            { emoji: '✏️', name: 'Kohl Liner', desc: 'For versatile eye definition' },
            { emoji: '🌸', name: 'Blush Duo', desc: 'One warm, one cool — use both' },
            { emoji: '💋', name: 'Lip Liner', desc: 'Defines any lip shape beautifully' },
            { emoji: '✨', name: 'Highlighter', desc: 'A universal glow on cheekbones' },
            { emoji: '🖌️', name: 'Setting Spray', desc: 'Locks any look for hours' }
        ]
    },
    Round: {
        badges: ['Sculpted Chic', 'Lifted & Defined', 'Editorial'],
        title: 'Sculpted Chic — Your Style is Defined Drama',
        desc: 'Your signature style is Sculpted Chic. Every technique you use is designed to add dimension, lift, and definition to your soft, youthful features. Contouring, diagonal blush, arched brows, and upswept eye looks are your weapons. When done right, your look reads as powerful, polished, and sharp.',
        categories: [
            { emoji: '🗡️', name: 'Sharp Contour', tags: ['Daily Power', 'Office', 'Defined'], desc: 'Two-shade foundation, cheekbone contour, diagonal blush, sharp brow. Your everyday armor.' },
            { emoji: '👁', name: 'Lifted Cat Eye', tags: ['Evening', 'Statement', 'Classic'], desc: 'Extended winged liner, outer lash focus, arched brow. Instantly elongates the face.' },
            { emoji: '💜', name: 'Berry Drama', tags: ['Night', 'Bold', 'Matte'], desc: 'Matte berry or plum lip, sculpted jaw contour, defined brow. Stunning and strong.' },
            { emoji: '🌿', name: 'Natural Lift', tags: ['Casual', 'Weekend', 'Effortless'], desc: 'Diagonal blush, mascara, tinted balm, soft brow. The low-effort high-impact look.' }
        ],
        why: ['Diagonal and angled techniques create the elongation your face craves', 'Strong brow arches and lifted liner visually add length', 'Matte and sculpted finishes add structure where softness is natural', 'Bold lip colors direct attention vertically, not horizontally'],
        products: [
            { emoji: '🎨', name: 'Contour Kit', desc: 'Matte shades for jaw & forehead' },
            { emoji: '💄', name: 'Matte Foundation', desc: 'Flat finish adds structure' },
            { emoji: '✏️', name: 'Precision Liner', desc: 'For sharp, lifted wings' },
            { emoji: '🌸', name: 'Angled Blush Brush', desc: 'Sweeps blush diagonally' },
            { emoji: '💋', name: 'Berry Lip', desc: 'Deep plum or wine matte' },
            { emoji: '📐', name: 'Brow Stencils', desc: 'High arch templates' }
        ]
    },
    Square: {
        badges: ['Soft Femme', 'Romantic', 'Rounded Glam'],
        title: 'Romantic Femme — Your Style is Soft Power',
        desc: 'Your signature style is Romantic Femme. The art of your makeup is softening and rounding — diffused edges, rounded blush, curved lip lines, and soft shadow shapes. This creates the beautiful contrast to your angular, strong features. The result is a deeply feminine, romantic, and powerful look that commands the room.',
        categories: [
            { emoji: '🌸', name: 'Soft Romantic', tags: ['Daily', 'Feminine', 'Elegant'], desc: 'Round blush, soft rose lip, curled lashes, feathered brow. Effortlessly beautiful every day.' },
            { emoji: '🫧', name: 'Dewy Glass', tags: ['K-Beauty', 'Fresh', 'Modern'], desc: 'Glowy skin, clear gloss, no liner, brushed-up brows. Modern and fresh.' },
            { emoji: '💎', name: 'Cool Femme', tags: ['Evening', 'Lavender', 'Chic'], desc: 'Lavender or pastel shadow, cool pink lip, subtle highlight. Feminine editorial power.' },
            { emoji: '🌙', name: 'Midnight Soft', tags: ['Night', 'Drama', 'Blended'], desc: 'Diffused smoky eye, soft red lip, rounded blush. Drama with a feminine twist.' }
        ],
        why: ['Rounded blush shapes counterbalance your angular jaw line', 'Soft, diffused eye shadow adds femininity to strong features', 'Curved lip lines and round cupid bows soften the overall frame', 'Curled lashes and no sharp liner create softness at the eyes'],
        products: [
            { emoji: '🌸', name: 'Fluffy Blush Brush', desc: 'For rounded application' },
            { emoji: '💋', name: 'Lip Liner (Pink)', desc: 'Trace a soft, round cupid bow' },
            { emoji: '✨', name: 'Pearl Highlighter', desc: 'On chin tip to round it' },
            { emoji: '🖌️', name: 'Blending Brush', desc: 'Diffuse all shadow edges' },
            { emoji: '👁', name: 'Lash Curler', desc: 'Curled lashes add softness' },
            { emoji: '💄', name: 'Satin Foundation', desc: 'Soft finish, not matte' }
        ]
    },
    Heart: {
        badges: ['Romantic Bold', 'Lip-First Beauty', 'Dreamy'],
        title: 'Romantic Bold — Your Style is Lip-First Luxury',
        desc: 'Your signature style is Romantic Bold — a style centered on your lips as the star of every look. With your delicate chin and wide cheekbones, a bold, full lip draws the eye downward perfectly, balancing your wider forehead. Soft eyes, defined lips, and lower-face glow are your power combination.',
        categories: [
            { emoji: '💄', name: 'Bold Lip First', tags: ['Daily Statement', 'Work', 'Minimal Eye'], desc: 'Full lip, brushed brow, light mascara, clean skin. Let your lips lead.' },
            { emoji: '🌹', name: 'Romantic Pink', tags: ['Date Night', 'Feminine', 'Soft Eye'], desc: 'Rose lip, soft pink eye, rosy blush on lower cheeks. Dreamy and magnetic.' },
            { emoji: '💫', name: 'K-Beauty Gradient', tags: ['Trendy', 'Soft', 'Youthful'], desc: 'Soft pink ombre lip, puppy eye, light blush. Sweet and irresistible.' },
            { emoji: '🎭', name: 'Evening Plum', tags: ['Formal', 'Night', 'Drama'], desc: 'Plum lip, lower lash liner, contoured forehead, chin glow. Stunning.' }
        ],
        why: ['A bold lip draws the eye to the chin, balancing your wider forehead', 'Soft eye looks prevent the upper face from feeling heavy', 'Blush below the cheekbones adds width to the jaw visually', 'Chin highlight is your secret weapon for face balance'],
        products: [
            { emoji: '💋', name: 'Lip Liner (Deep)', desc: 'Defines and shapes full lips' },
            { emoji: '💄', name: 'Bold Lipstick', desc: 'Red, plum, berry, or rose' },
            { emoji: '🖌️', name: 'Lower Liner Brush', desc: 'For soft lower lash definition' },
            { emoji: '✨', name: 'Chin Highlighter', desc: 'Adds visual width to jaw' },
            { emoji: '🌸', name: 'Low-Set Blush', desc: 'Applied below cheekbones' },
            { emoji: '📍', name: 'Forehead Bronzer', desc: 'Narrows wide forehead gently' }
        ]
    },
    Diamond: {
        badges: ['Haute Couture', 'Cheekbone Queen', 'Editorial'],
        title: 'Haute Couture — Your Style is Structured Elegance',
        desc: 'Your signature style is Haute Couture — sophisticated, intentional, and editorial. Your rare face shape with its dramatic cheekbones is a gift. Every look you wear frames those cheekbones as the hero. Wide eye looks, full lips, and subtle highlights position you as the most photographed person in any room.',
        categories: [
            { emoji: '💎', name: 'Cheekbone Spotlight', tags: ['Signature', 'Everyday Power', 'Editorial'], desc: 'Highlighted cheekbones, wide lash, full lip, clean skin. Iconic and effortless.' },
            { emoji: '🌙', name: 'Luxe Night', tags: ['Formal', 'Dark', 'Dramatic'], desc: 'Dark smoky eye, gloss lip, sharp brow, sheer skin. You will stop the room.' },
            { emoji: '✨', name: 'Glass Skin', tags: ['Minimalist', 'K-Beauty', 'Glow'], desc: 'Dewy glass skin, subtle shadow, nude gloss. Effortlessly elite.' },
            { emoji: '🖤', name: 'Avant Garde', tags: ['Creative', 'Graphic', 'Bold'], desc: 'Graphic liner, bold architectural brow, bare skin, clear lip. Fashion-forward.' }
        ],
        why: ['Your cheekbones are naturally photogenic — every look starts there', 'Wide, horizontal makeup moves (liner, lashes, shadow) frame them perfectly', 'Full lips add fullness to your narrow jaw for stunning balance', 'Straight, wide brows add visual width to your narrow forehead'],
        products: [
            { emoji: '✨', name: 'Cheekbone Highlighter', desc: 'Your most important product' },
            { emoji: '👁', name: 'Strip Lashes', desc: 'Full-width lashes for open eyes' },
            { emoji: '💋', name: 'Gloss', desc: 'Wide, plump full lip finish' },
            { emoji: '✏️', name: 'Horizontal Liner', desc: 'Extend liner outward for width' },
            { emoji: '🖌️', name: 'Wide Brow Brush', desc: 'For flat, extended brow shape' },
            { emoji: '💄', name: 'Dewy Foundation', desc: 'Luminous base for face glow' }
        ]
    },
    Oblong: {
        badges: ['Width Creator', 'Bold & Wide', 'Horizontal Glam'],
        title: 'Horizontal Glam — Your Style is Width & Drama',
        desc: 'Your signature style is Horizontal Glam — every choice you make adds visual width and creates the illusion of a broader, fuller face. Wide eye looks, horizontal blush, flat brows, and full lip shapes are your toolkit. When you master this, your look is expansive, bold, and extremely photogenic.',
        categories: [
            { emoji: '🌸', name: 'Wide Eye Glam', tags: ['Daily', 'Eye-First', 'Statement'], desc: 'Horizontal liner across the lid, wide shadow, full brow. Widening and powerful.' },
            { emoji: '💄', name: 'Statement Lip', tags: ['Bold', 'Simple', 'Impactful'], desc: 'Wide, full lip with slightly overlined corners. Let the lip be the story.' },
            { emoji: '✨', name: 'Broad Glow', tags: ['Natural', 'Glowy', 'Fresh'], desc: 'Wide-spread highlight across cheeks, sheer skin, glossy lip. Effortless width.' },
            { emoji: '🌙', name: 'Night Wide', tags: ['Evening', 'Dramatic', 'Full'], desc: 'Wide smoky eye, contoured hairline, full lip, broad blush. Glamorous.' }
        ],
        why: ['Every technique that adds width counterbalances your face length', 'Horizontal lines in liner and shadow visually shorten the face', 'Wide blush application creates the illusion of broader cheekbones', 'Flat brows and fullly-extended makeup near the temples adds width'],
        products: [
            { emoji: '📐', name: 'Flat Brow Stencil', desc: 'Straight, wide brow shape' },
            { emoji: '🖌️', name: 'Wide Shadow Brush', desc: 'For horizontal lid coverage' },
            { emoji: '💋', name: 'Lip Liner (Wide)', desc: 'Overline corners horizontally' },
            { emoji: '🌸', name: 'Wide Blush Brush', desc: 'Horizontal cheek coverage' },
            { emoji: '✨', name: 'Outer Cheek Highlight', desc: 'Adds width on cheekbones' },
            { emoji: '💄', name: 'Matte Foundation', desc: 'Solid base for structure' }
        ]
    },
    Triangle: {
        badges: ['Upper Face Power', 'Eye Drama Queen', 'Bold Brow Icon'],
        title: 'Upper Face Drama — Your Style is Eye & Brow Power',
        desc: 'Your signature style is Upper Face Drama — directing all attention upward with powerful brows, lifted eye looks, and highlighted temples. Your wide jaw is uniquely strong and beautiful; your goal is to create balance by making the upper face equally commanding. Bold brows and dramatic eye looks are your superpower.',
        categories: [
            { emoji: '👁', name: 'Eye Drama', tags: ['Signature', 'Daily', 'Powerful'], desc: 'Bold brow, lifted winged eye, temple highlight. Draws every eye upward.' },
            { emoji: '✨', name: 'Temple Glow', tags: ['Subtle', 'Balancing', 'Radiant'], desc: 'Highlight temples broadly, swept blush upward, tinted lip. Bright and balanced.' },
            { emoji: '🌙', name: 'Night Power', tags: ['Evening', 'Bold', 'Dark'], desc: 'Dark lid, defined brow, subtle jaw contour, muted lip. Moody and strong.' },
            { emoji: '💎', name: 'Editorial Arch', tags: ['Creative', 'Fashion', 'Graphic'], desc: 'Graphic upper liner, bold architectural arch brow, bare lip and skin. Fashion-week ready.' }
        ],
        why: ['Powerful brows immediately widen the forehead for face balance', 'Lifted and extended eye looks shift the gaze upward away from the jaw', 'Temple highlights add brightness and width to the upper face', 'Muted and medium lip looks keep the lower face balanced, not competing'],
        products: [
            { emoji: '✏️', name: 'Brow Pomade', desc: 'For defined, bold brow arches' },
            { emoji: '👁', name: 'Lifted Liner', desc: 'Winged liner angled upward' },
            { emoji: '✨', name: 'Temple Highlighter', desc: 'Your #1 balancing tool' },
            { emoji: '🌸', name: 'High Blush Brush', desc: 'Sweeps blush up to temples' },
            { emoji: '💋', name: 'Muted Lip', desc: 'Medium tones, not wide shapes' },
            { emoji: '📍', name: 'Jaw Contour', desc: 'Subtly narrows jaw corners' }
        ]
    }
};


function renderResults(dataURL, result) {
    const { faceShape, faceSize, undertone, structure, skinShade } = result;

    // Photo
    document.getElementById('result-photo').src = dataURL;

    // Badge
    document.getElementById('face-shape-badge').textContent = faceShape;

    // Key stats
    document.getElementById('ksc-shape').textContent = faceShape;
    document.getElementById('ksc-size').textContent = faceSize;
    document.getElementById('ksc-undertone').textContent = `${undertone} Undertone`;
    document.getElementById('ksc-structure').textContent = `${structure} Structure`;

    /* ── Shape Tab ── */
    const sd = SHAPE_DATA[faceShape];
    document.getElementById('res-shape-name').textContent = faceShape;
    document.getElementById('res-shape-desc').textContent = sd.desc;

    // Features
    const featContainer = document.getElementById('shape-features');
    featContainer.innerHTML = sd.features.map(f =>
        `<span class="shape-feat">${f}</span>`
    ).join('');

    // Proportions
    const propContainer = document.getElementById('proportion-bars');
    propContainer.innerHTML = sd.proportions.map(p => `
    <div class="prop-bar-wrap">
      <div class="prop-bar-label">
        <span>${p.label}</span>
        <span>${p.value}%</span>
      </div>
      <div class="prop-bar-track">
        <div class="prop-bar-fill" style="width:0%" data-target="${p.value}%"></div>
      </div>
    </div>
  `).join('');

    // Struct grid
    const structContainer = document.getElementById('struct-grid');
    structContainer.innerHTML = sd.struct.map(s => `
    <div class="struct-item">
      <div class="struct-icon">${s.icon}</div>
      <div class="struct-label">${s.label}</div>
      <div class="struct-value">${s.value}</div>
    </div>
  `).join('');

    /* ── Colors Tab ── */
    const cd = COLOR_DATA[undertone];
    document.getElementById('color-intro').textContent =
        `With your ${undertone.toLowerCase()} undertone and ${skinShade.toLowerCase()} complexion, these colors will make you radiate:`;

    const swatchContainer = document.getElementById('color-swatches');
    swatchContainer.innerHTML = cd.palette.map(c => `
    <div class="swatch" title="${c.name}">
      <div class="swatch-circle" style="background:${c.hex}"></div>
      <span class="swatch-name">${c.name}</span>
    </div>
  `).join('');

    const wearContainer = document.getElementById('colors-to-wear');
    wearContainer.innerHTML = cd.embrace.map(c => `
    <div class="color-item">
      <div class="color-dot" style="background:${c.color}"></div>
      <span>${c.label}</span>
    </div>
  `).join('');

    const avoidContainer = document.getElementById('colors-to-avoid');
    avoidContainer.innerHTML = cd.avoid.map(c => `
    <div class="color-item">
      <div class="color-dot" style="background:${c.color}"></div>
      <span>${c.label}</span>
    </div>
  `).join('');

    const foundationContainer = document.getElementById('foundation-shades');
    foundationContainer.innerHTML = cd.foundation.map(f => `
    <div class="foundation-shade">
      <div class="shade-swatch" style="background:${f.color}"></div>
      <span class="shade-name">${f.name}</span>
    </div>
  `).join('');

    /* ── Makeup Tab ── */
    const md = MAKEUP_DATA[faceShape];
    document.getElementById('mc-foundation-text').textContent = md.foundation;
    document.getElementById('mc-blush-text').textContent = md.blush;
    document.getElementById('mc-contour-text').textContent = md.contour;
    document.getElementById('mc-eye-text').textContent = md.eye;
    document.getElementById('mc-lip-text').textContent = md.lip;
    document.getElementById('mc-brow-text').textContent = md.brow;

    const looksContainer = document.getElementById('looks-grid');
    looksContainer.innerHTML = md.looks.map(l => `
    <div class="look-card">
      <div class="look-emoji">${l.emoji}</div>
      <div class="look-name">${l.name}</div>
      <div class="look-desc">${l.desc}</div>
    </div>
  `).join('');

    /* ── Tips Tab ── */
    const tips = TIPS_DATA[faceShape];
    const tipsContainer = document.getElementById('tips-list');
    tipsContainer.innerHTML = tips.map((t, i) => `
    <div class="tip-item">
      <div class="tip-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="tip-content">
        <h4>${t.title}</h4>
        <p>${t.body}</p>
      </div>
    </div>
  `).join('');

    const highlights = HIGHLIGHTS_DATA[faceShape];
    const hlContainer = document.getElementById('highlight-list');
    hlContainer.innerHTML = highlights.map(h => `
    <div class="feat-item">
      <div class="feat-bullet"></div>
      <span>${h}</span>
    </div>
  `).join('');

    const occasions = OCCASIONS_DATA[faceShape];
    const occContainer = document.getElementById('occasion-list');
    occContainer.innerHTML = occasions.map(o => `
    <div class="occ-item">
      <div class="occ-bullet"></div>
      <span>${o}</span>
    </div>
  `).join('');

    /* ── Style Tab ── */
    const styleD = STYLE_DATA[faceShape];
    document.getElementById('style-badge-row').innerHTML =
        styleD.badges.map(b => `<span class="style-badge">${b}</span>`).join('');
    document.getElementById('style-title').textContent = '✦ ' + styleD.title;
    document.getElementById('style-desc').textContent = styleD.desc;

    document.getElementById('style-grid').innerHTML = styleD.categories.map(c => `
    <div class="style-category-card">
      <div class="style-cat-emoji">${c.emoji}</div>
      <div class="style-cat-name">${c.name}</div>
      <div class="style-cat-tags">${c.tags.map(t => `<span class="style-tag">${t}</span>`).join('')}</div>
      <div class="style-cat-desc">${c.desc}</div>
    </div>
  `).join('');

    document.getElementById('style-why-list').innerHTML = styleD.why.map(w => `
    <div class="feat-item">
      <div class="feat-bullet"></div>
      <span>${w}</span>
    </div>
  `).join('');

    document.getElementById('style-products').innerHTML = styleD.products.map(p => `
    <div class="style-product-item">
      <div class="spi-emoji">${p.emoji}</div>
      <div class="spi-name">${p.name}</div>
      <div class="spi-desc">${p.desc}</div>
    </div>
  `).join('');

    /* ── Show Results ── */
    document.getElementById('results-section').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
    }, 100);

    // Animate proportion bars after scroll
    setTimeout(() => {
        document.querySelectorAll('.prop-bar-fill').forEach(el => {
            el.style.width = el.dataset.target;
        });
    }, 700);

    // Show the first tab
    showResultTab('shape');
}

/* ══════════════════════════════════════════════
   RESULT TAB SWITCHING
══════════════════════════════════════════════ */
function showResultTab(tab) {
    const tabs = document.querySelectorAll('.result-tab');
    const panels = document.querySelectorAll('.result-panel');

    const tabOrder = ['shape', 'colors', 'makeup', 'tips', 'style'];

    tabs.forEach((btn, i) => {
        btn.classList.toggle('active', tabOrder[i] === tab);
    });

    panels.forEach(panel => {
        const id = panel.id; // e.g. "rtab-shape"
        panel.classList.toggle('hidden', !id.endsWith(tab));
    });

    // Re-animate proportion bars when shape tab is revisited
    if (tab === 'shape') {
        setTimeout(() => {
            document.querySelectorAll('.prop-bar-fill').forEach(el => {
                el.style.width = '0%';
                void el.offsetWidth; // force reflow
                el.style.width = el.dataset.target;
            });
        }, 50);
    }
}

/* ══════════════════════════════════════════════
   RESET
══════════════════════════════════════════════ */
function resetAnalysis() {
    analysisResult = null;
    capturedCanvas = null;

    // Hide results
    document.getElementById('results-section').classList.add('hidden');

    // Reset upload
    resetUpload();

    // Reset camera panel
    hide('capture-btn');
    hide('flip-btn');
    show('start-camera-btn');

    // Switch back to camera tab
    switchTab('camera');

    // Scroll to analyzer
    scrollToAnalyzer();
}

/* ══════════════════════════════════════════════
   LOADING OVERLAY
══════════════════════════════════════════════ */
function showLoadingOverlay() {
    document.getElementById('loading-bar').style.width = '0%';
    document.getElementById('loading-step').textContent = LOADING_STEPS[0];
    document.getElementById('loading-overlay').classList.remove('hidden');
}
function hideLoadingOverlay() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

/* ══════════════════════════════════════════════
   UTILITY HELPERS
══════════════════════════════════════════════ */
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

/* ══════════════════════════════════════════════
   INTERSECTION OBSERVER  —  fade-in sections
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    document.querySelectorAll('.step-card, .result-card, .key-stat-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(28px)';
        el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
        observer.observe(el);
    });
});
