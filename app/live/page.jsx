'use client';

import Nav from '@/components/Nav';
import Sidebar from '@/components/Sidebar';
import FeatureNavigator from '@/components/FeatureNavigator';
import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';

/* ---- small UI bits ---- */
function Bubble({ role, text, img }) {
  const mine = role === 'user';
  return (
    <div className={'w-full flex ' + (mine ? 'justify-end' : 'justify-start')}>
      <div
        className={
          (mine ? 'bg-[color:var(--brand)] text-white' : 'bg-gray-100 text-[color:var(--fg)]') +
          ' max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap'
        }
      >
        {img ? <img src={img} alt="" className="rounded-lg max-w-full" /> : text}
      </div>
    </div>
  );
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const NOW = () => new Date().toISOString();

export default function Live() {
  /* ---- UI & state ---- */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState('');
  const listRef = useRef(null);

  /* billing/session */
  const [connected, setConnected] = useState(false);
  const [credits, setCredits] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [left, setLeft] = useState(0);

  /* voice/lang */
  const [voice, setVoice] = useState('verse');
  const [lang, setLang] = useState('en');
  const [spkOn, setSpkOn] = useState(true);

  // voice selection: auto map by language unless user manually changes
  const userVoiceTouchedRef = useRef(false);
  function voiceForLanguage(l) {
    // tweak mapping here (feel free to change voices you like)
    return l === 'hi' ? 'alloy' : 'verse';
  }
  function currentVoice() {
    return userVoiceTouchedRef.current ? voice : voiceForLanguage(lang);
  }


  /* tools */
  const [faces, setFaces] = useState(0);
  const [showFaceBanner, setShowFaceBanner] = useState(false);
  const [mode, setMode] = useState('avatar'); // 'avatar' | 'face' | 'palm'
  const modeRef = useRef('avatar');
  const pendingModeRef = useRef(null); // wait for "confirm" via voice/text

  /* rtc & media */
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const overlayRef = useRef(null);
  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const pendingRef = useRef({});
  const connectingRef = useRef(false);

  /* history */
  const sessionIdRef = useRef(null);
  const sessionStartRef = useRef(null);

  /* models */
  const faceRef = useRef(null);
  const handRef = useRef(null);

  /* mouth animation */
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const talkAnimRef = useRef(null);
  const liveUserMsgIdRef = useRef(null); // ephemeral transcript bubble id

  /* pro face-reader persona/capture */
  const [personName, setPersonName] = useState('');
  const awaitingNameRef = useRef(false);
  const lastFaceCaptureRef = useRef(0);
  const lastFaceLandmarksRef = useRef(null);

  /* boot */
  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('astrotalk:user') || 'null');
    if (!u) {
      location.assign('/login');
      return;
    }
    setCredits(Number(localStorage.getItem('astrotalk:credits') || '0'));

    const onResize = () => resizeCanvasToVideo();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /* auto-scroll chat */
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* ---- history draft autosave ---- */
  function saveDraft(msgs) {
    try {
      const user = JSON.parse(localStorage.getItem('astrotalk:user') || 'null');
      const item = {
        id: sessionIdRef.current || 'sess_' + Date.now(),
        start: sessionStartRef.current,
        updated: NOW(),
        userMeta: user,
        modeLast: modeRef.current,
        messages: msgs,
      };
      localStorage.setItem('astrotalk:current', JSON.stringify(item));
    } catch {}
  }

  function addMsg(m) {
    setMessages((x) => {
      const next = [
        ...x,
        { id: m.id || String(Date.now() + Math.random()), role: m.role || 'assistant', text: m.text || '', img: m.img, at: NOW() },
      ];
      saveDraft(next); // autosave every message to current session
      return next;
    });
  }

  function resizeCanvasToVideo() {
    const v = videoRef.current;
    const c = overlayRef.current;
    if (v && c && v.videoWidth && v.videoHeight) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
    }
  }

  function saveHistory({ reason = 'manual', msgs = messages } = {}) {
    try {
      const user = JSON.parse(localStorage.getItem('astrotalk:user') || 'null');
      const item = {
        id: sessionIdRef.current || 'sess_' + Date.now(),
        start: sessionStartRef.current,
        end: NOW(),
        reason,
        userMeta: user,
        modeLast: modeRef.current,
        messages: msgs,
      };
      const all = JSON.parse(localStorage.getItem('astrotalk:history') || '[]');
      all.unshift(item);
      localStorage.setItem('astrotalk:history', JSON.stringify(all));
      localStorage.removeItem('astrotalk:current');
    } catch {}
  }

  async function getClientSecret() {
    const res = await fetch(`/api/rt-session?voice=${voice}&lang=${lang}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`/api/rt-session ${res.status}`);
    const j = await res.json();
    const key = j?.client_secret?.value;
    if (!key) throw new Error('No client secret in response');
    return key;
  }

  /* speak helper — request audio+text from the model without adding a user message */
  function speak(text) {
    if (!text || !dcRef.current) return;
    try {
      dcRef.current.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio', 'text'],
            audio: { voice: currentVoice() },
            instructions: text,
          },
        }),
      );
    } catch (e) {
      console.warn('speak() failed:', e);
    }
  }

  /* modes */
  function activateMode(newMode) {
    if (newMode === modeRef.current) return;
    modeRef.current = newMode;
    setMode(newMode);
    const c = overlayRef.current;
    if (newMode === 'avatar' && c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    addMsg({
      role: 'assistant',
      text:
        newMode === 'avatar'
          ? (lang === 'hi'
              ? 'Avatar mode par laut raha hoon. Aap apne sawal puch sakte hain.'
              : 'Back to avatar mode. Ask me anything!')
          : newMode === 'face'
          ? (lang === 'hi'
              ? 'Face reading ON — roshni me rehkar seedha dekhein. (sirf manoranjan)'
              : 'Face reading ON—keep your face centered with good light. (entertainment only)')
          : (lang === 'hi'
              ? 'Palm reading ON — haath camera ke kareeb seedha rakhein. (sirf manoranjan)'
              : 'Palm reading ON—hold your palm steady near the camera. (entertainment only)'),
    });
  }

  function analyzePalm(handLandmarks) {
    if (!handLandmarks?.length) return null;
    const pts = handLandmarks[0];
    const spread = Math.hypot(pts[5].x - pts[17].x, pts[5].y - pts[17].y);
    if (spread > 0.2) {
      return [
        'You are independent and energetic.',
        'Strong drive to lead and initiate.',
        'Balance rest to avoid burnout.',
        'Guidance: Prioritize one goal this week.',
      ].join('\n• ');
    }
    return [
      'You value stability and harmony.',
      'Practical and detail-oriented mindset.',
      'Deep loyalty in relationships.',
      'Guidance: Write one gratitude note today.',
    ].join('\n• ');
  }

  /* ---------- FACE PART CROPS ---------- */
  function faceBBox(landmarks, cW, cH) {
    const xs = landmarks.map((p) => p.x);
    const ys = landmarks.map((p) => p.y);
    const minX = Math.min(...xs) * cW, maxX = Math.max(...xs) * cW;
    const minY = Math.min(...ys) * cH, maxY = Math.max(...ys) * cH;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  function cropRectFromVideo(video, rect) {
    const tmp = document.createElement('canvas');
    tmp.width = Math.max(32, Math.floor(rect.w));
    tmp.height = Math.max(32, Math.floor(rect.h));
    const ctx = tmp.getContext('2d');
    ctx.drawImage(
      video,
      Math.max(0, Math.floor(rect.x)),
      Math.max(0, Math.floor(rect.y)),
      Math.max(1, Math.floor(rect.w)),
      Math.max(1, Math.floor(rect.h)),
      0, 0, tmp.width, tmp.height
    );
    return tmp.toDataURL('image/png');
  }
  function captureFaceParts(video, landmarks, canvas) {
    if (!landmarks || !video?.videoWidth) return null;
    const cW = canvas?.width || video.videoWidth;
    const cH = canvas?.height || video.videoHeight;
    const { x, y, w, h } = faceBBox(landmarks, cW, cH);
    const R = {
      forehead: { x: x + 0.20*w, y: y + 0.08*h, w: 0.60*w, h: 0.20*h },
      eyes:     { x: x + 0.15*w, y: y + 0.28*h, w: 0.70*w, h: 0.16*h },
      nose:     { x: x + 0.32*w, y: y + 0.48*h, w: 0.36*w, h: 0.18*h },
      lips:     { x: x + 0.28*w, y: y + 0.66*h, w: 0.44*w, h: 0.12*h },
      chin:     { x: x + 0.21*w, y: y + 0.80*h, w: 0.58*w, h: 0.18*h },
    };
    return {
      forehead: cropRectFromVideo(video, R.forehead),
      eyes:     cropRectFromVideo(video, R.eyes),
      nose:     cropRectFromVideo(video, R.nose),
      lips:     cropRectFromVideo(video, R.lips),
      chin:     cropRectFromVideo(video, R.chin),
      rects: R,
    };
  }
  function facePartSummaries(name = 'you', lng = 'en') {
    const who = name || (lng === 'hi' ? 'aap' : 'you');
    if (lng === 'hi') {
      return {
        forehead: `Maathaa (buddhi/vision): ${who} ki soch spasht aur door-darshi lagti hai.`,
        eyes:     `Aankhen (abhivyakti/soojh-boojh): samvedansheel aur dhyaan-se sunne wale.`,
        nose:     `Naak (drive/discipline): zimmedaari nibhane mein dridh.`,
        lips:     `Honth (sanchar/sneh): garamjoshi se baat karte hain; vishvaas banate hain.`,
        chin:     `Chin (ichcha-shakti/sthirata): chunautiyon me sthir rehte hain.`,
      };
    }
    return {
      forehead: `Forehead (wisdom/vision): ${who} show clear thinking and long-range planning.`,
      eyes:     `Eyes (expression/intuition): attentive and empathetic—good at reading people.`,
      nose:     `Nose (drive/discipline): steady determination and follow-through.`,
      lips:     `Lips (communication/affection): warm communicator; honest words build trust.`,
      chin:     `Chin (will/stability): resilient and grounded during challenges.`,
    };
  }

  function naturalRouter(text) {
    const t = text.toLowerCase();

    // If we are waiting for a name, capture it first (simple parsing)
    if (awaitingNameRef.current) {
      let nm = text.trim();
      const tl = nm.toLowerCase();
      if (tl.startsWith('my name is ')) nm = nm.slice(11);
      else if (tl.startsWith('i am ')) nm = nm.slice(5);
      else if (tl.startsWith("i'm ")) nm = nm.slice(4);
      // accept short names (<=3 words)
      if (nm.split(/\s+/).length <= 3) nm = nm.replace(/[.]/g, '').slice(0, 30).trim();
      else nm = '';

      if (nm) {
        awaitingNameRef.current = false;
        setPersonName(nm);
        addMsg({ role: 'assistant', text: lang === 'hi' ? `Dhanyavaad, ${nm}! Aaiye shuru karte hain.` : `Thanks, ${nm}! Let’s begin.` });
        speak(lang === 'hi' ? `${nm}, aaiye shuru karte hain.` : `${nm}, let’s begin.`);
        return true;
      } else {
        addMsg({ role: 'assistant', text: lang === 'hi' ? 'Kripya apna naam batayein.' : 'Please tell me your name.' });
        speak(lang === 'hi' ? 'Kripya apna naam batayein.' : 'Please tell me your name.');
        return true;
      }
    }

    // pending confirm → activate
    if (pendingModeRef.current && ['yes','confirm','haan','haanji','start'].some((w) => t.includes(w))) {
      const m = pendingModeRef.current;
      activateMode(m);
      pendingModeRef.current = null;
      if (m === 'face') {
        if (!personName) {
          awaitingNameRef.current = true;
          addMsg({ role: 'assistant', text: lang === 'hi' ? 'Shuru karne se pehle, aapka naam?' : 'Before we start, what is your name?' });
          speak(lang === 'hi' ? 'Shuru karne se pehle, aapka naam?' : 'Before we start, what is your name?');
        } else {
          speak(lang === 'hi' ? 'Face reading shuru. Kripya seedha camera ki taraf dekhein.' : 'Face reading activated. Please look at the camera.');
        }
      } else if (m === 'palm') {
        speak(lang === 'hi' ? 'Palm reading shuru. Haath ko camera ke saamne seedha rakhein.' : 'Palm reading activated. Hold your palm steady near the camera.');
      }
      return true;
    }

    // stop -> avatar
    if (/\b(stop|band|avatar)\b/.test(t)) {
      activateMode('avatar');
      pendingModeRef.current = null;
      return true;
    }

    // requests
    if (/(read|do).*(my )?face|face reading/.test(t)) {
      addMsg({ role: 'assistant', text: lang === 'hi' ? 'Face reading chalu karun? “Confirm” bolein.' : 'Start Face Reading? Say “confirm”.' });
      pendingModeRef.current = 'face';
      return true;
    }
    if (/(read|do).*(my )?palm|palm reading|hand reading/.test(t)) {
      addMsg({ role: 'assistant', text: lang === 'hi' ? 'Palm reading chalu karun? “Confirm” bolein.' : 'Start Palm Reading? Say “confirm”.' });
      pendingModeRef.current = 'palm';
      return true;
    }

    // numerology
    if (t.includes('lo shu') || t.includes('numerology')) {
      addMsg({ text: lang === 'hi' ? 'Lo Shu bana raha hoon…' : 'Generating Lo Shu grid…' });
      const m = t.match(/(\d{4}-\d{2}-\d{2})/);
      if (m) addMsg({ img: '/api/images/loshu?dob=' + m[1] });
      else addMsg({ text: lang === 'hi' ? 'DOB (YYYY-MM-DD) bhejein.' : 'Share DOB (YYYY-MM-DD).' });
      return true;
    }

    // kundli
    if (t.includes('kundli') || t.includes('birth chart')) {
      const md = t.match(/(\d{4}-\d{2}-\d{2}).*(\d{2}:\d{2}).*at ([a-zA-Z ]+)/);
      if (md) addMsg({ img: `/api/images/kundli?dob=${md[1]}&time=${md[2]}&place=${encodeURIComponent(md[3])}` });
      else addMsg({ text: lang === 'hi' ? 'Kundli: DOB (YYYY-MM-DD), time (HH:MM), place (City).' : 'For kundli: DOB (YYYY-MM-DD), time (HH:MM), place (City).' });
      return true;
    }

    // tarot
    if (t.includes('tarot')) {
      addMsg({ text: lang === 'hi' ? 'Niche se tarot card chunein.' : 'Pick a tarot card below.' });
      return true;
    }

    return false;
  }

  async function start() {
    if (connectingRef.current || connected) return;
    if (credits <= 0) {
      alert('No credits. Go to pricing.');
      location.assign('/pricing');
      return;
    }

    connectingRef.current = true;
    setStatus('Starting…');
    sessionIdRef.current = 'sess_' + Date.now();
    sessionStartRef.current = NOW();

    try {
      let key = await getClientSecret();

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = audioRef.current || new Audio();
      audioEl.autoplay = true;

      pc.ontrack = (e) => {
        remoteRef.current = e.streams[0];
        audioEl.srcObject = remoteRef.current;
        audioEl.muted = !spkOn;

        // Enhanced mouth animation (RMS + band energy → viseme-ish)
        try {
          if (!audioCtxRef.current) {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const src = ctx.createMediaStreamSource(remoteRef.current);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.7;
            src.connect(analyser);
            audioCtxRef.current = ctx;
            analyserRef.current = analyser;
            try { ctx.resume(); } catch {}

            const timeData = new Uint8Array(analyser.frequencyBinCount);
            const freqData = new Uint8Array(analyser.frequencyBinCount);

            let level = 0; // smoothed mouth open 0..1
            const step = () => {
              if (!analyserRef.current) return;
              analyserRef.current.getByteTimeDomainData(timeData);
              analyserRef.current.getByteFrequencyData(freqData);

              // RMS amplitude 0..1
              let sum = 0;
              for (let i = 0; i < timeData.length; i++) {
                const v = timeData[i] - 128;
                sum += v * v;
              }
              const rms = Math.sqrt(sum / timeData.length) / 128;

              // Mid-band energy approx 300–3000 Hz
              const midStart = Math.floor(freqData.length * 0.06);
              const midEnd = Math.floor(freqData.length * 0.6);
              let mid = 0;
              for (let i = midStart; i < midEnd; i++) mid += freqData[i];
              mid = mid / ((midEnd - midStart) * 255);

              // Attack/decay smoothing keeps motion natural
              const target = Math.min(1.0, rms * 1.9 + mid * 0.7);
              const attack = 0.35;
              const decay = 0.08;
              level = target > level ? level * (1 - attack) + target * attack : level * (1 - decay) + target * decay;

              const scaleY = Math.min(1.35, Math.max(0.18, level + 0.05));
              const mouthEl = window.__mouthEl;
              const ringEl = window.__ringEl;
              if (mouthEl) mouthEl.style.transform = `translateX(-50%) scaleY(${scaleY})`;
              if (ringEl) ringEl.style.opacity = String(Math.min(1, 0.25 + level));

              talkAnimRef.current = requestAnimationFrame(step);
            };
            step();
          }
        } catch {}
      };

      // media — request mic & camera with user-friendly errors
      let media;
      try {
        media = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: { facingMode: 'user' },
        });
      } catch (e) {
        const hint =
          (e && (e.name === 'NotAllowedError' || /denied|permission/i.test(e.message)))
            ? (
                'Camera/Microphone permission is blocked. In Chrome: click the camera icon in the address bar → Allow, then Reload. On macOS: System Settings → Privacy & Security → Camera & Microphone → enable Chrome. Close other apps (Zoom/FaceTime) that might be using the camera.'
              )
            : 'Could not access camera/microphone.';
        addMsg({ role: 'assistant', text: `Join error: ${e.message || e} \n${hint}` });
        setStatus('Permission blocked');
        connectingRef.current = false;
        return;
      }
      localRef.current = media;
      media.getTracks().forEach((t) => pc.addTrack(t, media));
      if (videoRef.current) videoRef.current.srcObject = media;

      await new Promise((resolve) => {
        const v = videoRef.current;
        if (!v) return resolve();
        if (v.readyState >= 2 && v.videoWidth > 0) return resolve();
        const on = () => {
          if (v.videoWidth > 0) {
            v.removeEventListener('loadeddata', on);
            resolve();
          }
        };
        v.addEventListener('loadeddata', on);
      });
      resizeCanvasToVideo();

      // models
      const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm');
      faceRef.current = await FaceLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        },
        runningMode: 'VIDEO',
        numFaces: 5,
      });
      handRef.current = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        },
        runningMode: 'VIDEO',
        numHands: 2,
      });

      // vision loop
      const loop = () => {
        const v = videoRef.current;
        const c = overlayRef.current;
        if (!v || !c || v.videoWidth === 0) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        try {
          if (modeRef.current === 'face' && faceRef.current) {
            const f = faceRef.current.detectForVideo(v, performance.now());
            const landmarksArr = f.faceLandmarks || [];
            const count = landmarksArr.length;

            if (count !== faces) { setFaces(count); if (count > 1) setShowFaceBanner(true); }
            if (count <= 1 && showFaceBanner) setShowFaceBanner(false);

            // draw dots
            ctx.fillStyle = '#00e0ff';
            landmarksArr.forEach((arr) =>
              arr.forEach((pt) => ctx.fillRect(pt.x * c.width, pt.y * c.height, 2, 2)),
            );

            const lm = landmarksArr[0];
            lastFaceLandmarksRef.current = lm || null;

            // capture & narrate (every ~8s) once we know the person's name
            const now = performance.now();
            if (lm && personName && count === 1 && now - (lastFaceCaptureRef.current || 0) > 8000) {
              const parts = captureFaceParts(v, lm, c);
              if (parts) {
                const notes = facePartSummaries(personName, lang);
                addMsg({ role: 'assistant', text: lang === 'hi'
                  ? `Yeh ${personName} ka mukh-vishleshan hai (sirf manoranjan):`
                  : `Here’s ${personName}’s face reading (for fun):` });
                addMsg({ role: 'assistant', img: parts.forehead, text: notes.forehead });
                addMsg({ role: 'assistant', img: parts.eyes,     text: notes.eyes });
                addMsg({ role: 'assistant', img: parts.nose,     text: notes.nose });
                addMsg({ role: 'assistant', img: parts.lips,     text: notes.lips });
                addMsg({ role: 'assistant', img: parts.chin,     text: notes.chin });

                speak(lang === 'hi'
                  ? `${personName}, aapki maathay ki soch me spashtata, aankhon me samvedansheelta, aur chin me dridhata dikhti hai. Yeh sirf manoranjan ke liye hai.`
                  : `${personName}, your forehead suggests clarity, your eyes empathy, and your chin steady will. This is for entertainment only.`);

                lastFaceCaptureRef.current = now;
              }
            }
          } else if (modeRef.current === 'palm' && handRef.current) {
            const h = handRef.current.detectForVideo(v, performance.now());
            ctx.fillStyle = '#ff00aa';
            (h.landmarks || []).forEach((arr) =>
              arr.forEach((pt) => ctx.fillRect(pt.x * c.width, pt.y * c.height, 2, 2)),
            );
            if ((h.landmarks || []).length) {
              const reading = analyzePalm(h.landmarks);
              if (reading) {
                if (!loop._lastPalm || performance.now() - loop._lastPalm > 4000) {
                  addMsg({ role: 'assistant', text: '• ' + reading });
                  // also speak a concise insight
                  speak(
                    (lang === 'hi'
                      ? 'Hast rekha ke aadhar par (sirf manoranjan): '
                      : 'Palm insight (for fun): ') +
                    reading.split('\n• ')[0] // keep it short
                  );
                  loop._lastPalm = performance.now();
                }
              }
            }
          }
        } catch {}
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

      // data channel
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        setConnected(true);
        setStatus('Connected');

        const newC = Math.max(0, Number(localStorage.getItem('astrotalk:credits') || '0') - 1);
        localStorage.setItem('astrotalk:credits', String(newC));
        setCredits(newC);

        const plan = localStorage.getItem('astrotalk:plan') || 'standard';
        const cap = plan === 'pro' ? 0 : plan === 'advanced' ? 6 : 3;
        setElapsed(0);
        setLeft(cap ? cap * 60 : 0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setElapsed((e) => e + 1);
          if (cap) setLeft((t) => Math.max(0, t - 1));
        }, 1000);
        if (cap) {
          setTimeout(() => {
            addMsg({ text: `⏱️ ${cap} min done. Tap JOIN to continue (uses 1 credit).` });
            saveHistory({ reason: 'timecap' });
            setMessages([]);
            stop();
          }, cap * 60 * 1000);
        }

        // Ensure the model sends BOTH audio and text and does VAD-based turn taking
        try {
          dc.send(
            JSON.stringify({
              type: 'session.update',
              session: { voice: currentVoice(),
                modalities: ['audio', 'text'],
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  silence_duration_ms: 700,
                  prefix_padding_ms: 250,
                  create_response: true,
                },
              },
            }),
          );
        } catch {}

        const greeting =
          lang === 'hi'
            ? 'Namaste! Main aapka AI jyotishi hoon. Kya aap Face/Palm reading chahenge? Ya Numerology (Lo Shu), Tarot ya Kundli?'
            : 'Hello! I’m your AI astrologer. Would you like Face/Palm reading? Or Numerology (Lo Shu), Tarot or Kundli?';
        dc.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: greeting }] },
          }),
        );
        dc.send(
          JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['audio', 'text'],
              audio: { voice: currentVoice() },
            },
          }),
        );
      };

      dc.onmessage = (evt) => {
        let data;
        try {
          data = JSON.parse(evt.data);
        } catch {
          return;
        }

        // USER speech → partial transcript
        if (data.type === 'conversation.item.input_audio_transcription.delta') {
          const delta = data.delta || '';
          if (!liveUserMsgIdRef.current) {
            const id = 'u_live_' + Date.now();
            liveUserMsgIdRef.current = id;
            setMessages((m) => {
              const next = [...m, { id, role: 'user', text: delta }];
              saveDraft(next);
              return next;
            });
          } else {
            const id = liveUserMsgIdRef.current;
            setMessages((m) => {
              const next = m.map((x) => (x.id === id ? { ...x, text: (x.text || '') + delta } : x));
              saveDraft(next);
              return next;
            });
          }
        }

        // USER speech → final transcript
        if (data.type === 'conversation.item.input_audio_transcription.completed') {
          const t = data.transcript || data.output_text || '';
          const id = liveUserMsgIdRef.current;
          liveUserMsgIdRef.current = null;
          if (t.trim()) {
            if (id) {
              // replace ephemeral with final text
              setMessages((m) => {
                const next = m.map((x) => (x.id === id ? { ...x, text: t } : x));
                saveDraft(next);
                return next;
              });
            } else {
              addMsg({ role: 'user', text: t });
            }
            naturalRouter(t);
          }
        }

        // assistant streaming (handle several event shapes)
        if (data.type === 'response.created') {
          const id = data.response?.id || data.id;
          pendingRef.current[id] = '';
          addMsg({ id, role: 'assistant', text: '' });
        }
        if (data.type === 'response.output_text.delta' || data.type === 'response.delta') {
          const id = data.response?.id || Object.keys(pendingRef.current).at(-1);
          const next = (pendingRef.current[id] || '') + (data.delta || '');
          pendingRef.current[id] = next;
          setMessages((m) => {
            const up = m.map((x) => (x.id === id ? { ...x, text: next } : x));
            saveDraft(up);
            return up;
          });
        }
        if (data.type === 'response.output_text' && Array.isArray(data.output_text)) {
          const full = data.output_text.join('');
          addMsg({ role: 'assistant', text: full });
        }
        if (data.type === 'response.completed' || data.type === 'response.output_text.done') {
          const id = data.response?.id || data.id;
          const finalText = (data.response?.output_text || []).join('') || pendingRef.current[id] || '';
          if (finalText) {
            setMessages((m) => {
              const up = m.map((x) => (x.id === id ? { ...x, text: finalText } : x));
              saveDraft(up);
              return up;
            });
          }
        }
      };

      // SDP handshake
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      async function postOffer(k) {
        return fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
          method: 'POST',
          headers: { Authorization: `Bearer ${k}`, 'Content-Type': 'application/sdp', 'OpenAI-Beta': 'realtime=v1' },
          body: offer.sdp,
        });
      }

      let resp = await postOffer(key);
      if (resp.status === 401 || resp.status === 403) {
        key = await getClientSecret(); // refresh ek_ if expired
        resp = await postOffer(key);
      }
      const answerText = await resp.text();
      if (!resp.ok) {
        addMsg({ text: `Join failed (${resp.status}).` });
        saveHistory({ reason: 'error' });
        stop();
        return;
      }
      await pc.setRemoteDescription({ type: 'answer', sdp: answerText });
    } catch (e) {
      addMsg({ role: 'assistant', text: 'Join error: ' + e.message });
      setStatus('Error');
      saveHistory({ reason: 'error' });
      stop();
    } finally {
      connectingRef.current = false;
    }
  }

  function stop() {
    try {
      pcRef.current?.close();
    } catch {}
    localRef.current?.getTracks().forEach((t) => t.stop());
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const c = overlayRef.current;
    if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);

    // stop mouth anim + audio ctx
    if (talkAnimRef.current) cancelAnimationFrame(talkAnimRef.current);
    talkAnimRef.current = null;
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    const mouthEl = window.__mouthEl;
    if (mouthEl) mouthEl.style.transform = 'translateX(-50%) scaleY(0.18)';

    setConnected(false);
    setStatus('Stopped');
    setShowFaceBanner(false);
    activateMode('avatar');
  }

  async function sendText(e) {
    e.preventDefault();
    const text = composer.trim();
    if (!text) return;
    addMsg({ role: 'user', text });
    naturalRouter(text);
    if (dcRef.current) {
      dcRef.current.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
        }),
      );
      dcRef.current.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio', 'text'],
            audio: { voice: currentVoice() },
          },
        }),
      );
    }
    setComposer('');
  }

  function onPick(feature) {
    if (feature === 'tarot') {
      addMsg({ text: 'Choose a card: The Fool, The Star, The Lovers.' });
    } else if (feature === 'loshu') {
      addMsg({ text: 'Share DOB as YYYY-MM-DD to render your Lo Shu grid.' });
    } else if (feature === 'kundli') {
      addMsg({ text: 'Share DOB (YYYY-MM-DD), time (HH:MM), and place (City) for a basic kundli.' });
    } else if (feature === 'palm') {
      pendingModeRef.current = 'palm';
      addMsg({ text: 'Start Palm Reading? Say “confirm” to enable. (Only one tool runs at a time.)' });
    } else if (feature === 'face') {
      pendingModeRef.current = 'face';
      addMsg({ text: 'Start Face Reading? Say “confirm” to enable. (Only one tool runs at a time.)' });
    }
  }

  // snapshot current frame into chat
  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const tmp = document.createElement('canvas');
    tmp.width = v.videoWidth;
    tmp.height = v.videoHeight;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(v, 0, 0);
    const data = tmp.toDataURL('image/png');
    addMsg({ role: 'assistant', img: data });
  }

  const avatarSrc = '/avatar-astro.png';
  const showAvatar = mode === 'avatar';
  const avatarSizeClass = 'w-48 h-48';

  return (
    <main>
      <Nav />

      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((x) => !x)}
        onSelect={(sess) => {
          if (connected) stop();
          setStatus('Viewing history');
          setMessages(sess?.messages || []);
        }}
      />

      <div className="section py-4 grid lg:grid-cols-3 gap-4">
        {/* LEFT: video + controls */}
        <div className="lg:col-span-2 card p-3">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <button className="pill" onClick={() => setSidebarOpen((x) => !x)}>☰ History</button>
            <button
              className="pill"
              onClick={() => {
                // Save current and start a fresh chat UI
                if (messages.length) saveHistory({ reason: 'newchat' });
                setMessages([]);
                setStatus('Ready');
                sessionIdRef.current = 'sess_' + Date.now();
                sessionStartRef.current = NOW();
              }}
              title="Save this and start a fresh chat"
            >
              ✨ New Chat
            </button>

            <div className="ml-auto flex items-center gap-2">
              {!connected ? (
                <button className="btn btn-primary" onClick={start}>Join</button>
              ) : (
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    saveHistory({ reason: 'manual' });
                    setMessages([]);
                    stop();
                  }}
                >
                  End
                </button>
              )}
              <select className="input w-28" value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="en">EN</option>
                <option value="hi">HI</option>
              </select>
              <select className="input w-32" value={voice} onChange={(e) => { userVoiceTouchedRef.current = true; setVoice(e.target.value); }}>
                <option value="verse">Verse</option>
                <option value="shimmer">Shimmer</option>
                <option value="alloy">Alloy</option>
              </select>
              {/* Mode buttons (manual override) */}
              <div className="ml-2 flex gap-2">
                <button className={`pill ${mode === 'avatar' ? 'bg-[color:var(--soft)]' : ''}`} onClick={() => activateMode('avatar')}>Avatar</button>
                <button className={`pill ${mode === 'face' ? 'bg-[color:var(--soft)]' : ''}`} onClick={() => activateMode('face')}>Face</button>
                <button className={`pill ${mode === 'palm' ? 'bg-[color:var(--soft)]' : ''}`} onClick={() => activateMode('palm')}>Palm</button>
              </div>
            </div>
          </div>

          <div className="video-wrap relative rounded-2xl overflow-hidden bg-black aspect-video">
            {/* camera video (hidden when avatar mode or not connected) */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${mode === 'avatar' || !connected ? 'opacity-0' : ''}`}
              autoPlay
              muted
              playsInline
              onLoadedMetadata={resizeCanvasToVideo}
              onPlay={resizeCanvasToVideo}
            />

            {/* avatar overlay (only in Avatar mode) */}
            {showAvatar && (
              <div className="absolute inset-0 z-20 flex items-center justify-center">
                <div className={`relative ${avatarSizeClass}`}>
                  <img
                    src={avatarSrc}
                    onError={(e) => (e.currentTarget.src = 'https://placehold.co/240x240?text=Astro+Avatar')}
                    className={`rounded-full object-cover ${avatarSizeClass}`}
                    alt="avatar"
                  />
                  {/* talking mouth */}
                  <div
                    ref={(el) => (window.__mouthEl = el)}
                    className="absolute left-1/2 -translate-x-1/2 bottom-6 w-24 h-8 rounded-full bg-black/90 origin-center"
                    style={{ transform: 'translateX(-50%) scaleY(0.18)' }}
                  />
                  {/* subtle ring pulsing with volume */}
                  <div
                    ref={(el) => (window.__ringEl = el)}
                    className="absolute inset-0 rounded-full ring-4 ring-[color:var(--brand)]/30 animate-pulse"
                  />
                </div>
              </div>
            )}

            <canvas ref={overlayRef} className="absolute inset-0 w-full h-full z-30 pointer-events-none" width="1280" height="720" />
            
            {(mode !== 'avatar') && personName && connected && (
              <div className="absolute top-2 right-2 z-30 bg-white/90 backdrop-blur rounded-xl px-3 py-2 text-sm shadow">
                Reading for <b>{personName}</b> {mode === 'face' ? '(Face)' : '(Palm)'}
              </div>
            )}
{showFaceBanner && faces > 1 && (
              <div className="absolute top-2 left-2 z-30 bg-white/90 backdrop-blur rounded-xl px-3 py-2 text-sm shadow">
                I can see <b>{faces}</b> people. Continue with all? (say “yes” or “only me”)
              </div>
            )}
          </div>

          <div className="mt-2 flex gap-2 text-sm flex-wrap">
            <span className="pill">Status: {status}</span>
            <span className="pill">Mode: {mode}</span>
            {connected && (
              <span className="pill">
                ⏱ Elapsed {fmt(elapsed)} {left ? <>• Left {fmt(left)}</> : <>• Unlimited</>}
              </span>
            )}
            <button
              className="pill"
              onClick={() => setSpkOn((v) => (audioRef.current ? !(audioRef.current.muted = v) : !v))}
              title="Toggle speaker"
            >
              {spkOn ? '🔊 Mute' : '🔇 Unmute'}
            </button>
            <button className="pill" onClick={snap} title="Snapshot current frame">
              📸 Snapshot
            </button>
          </div>
          <audio ref={audioRef} />
        </div>

        {/* RIGHT: chat */}
        <div className="card p-3 flex flex-col h-[70vh]">
          <FeatureNavigator onPick={onPick} />
          <div ref={listRef} className="flex-1 overflow-auto space-y-2 pr-1">
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} text={m.text} img={m.img} />
            ))}
          </div>
          <form onSubmit={sendText} className="mt-2 flex gap-2">
            <input
              className="input flex-1"
              placeholder="Type your question…"
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
            />
            <button className="btn btn-primary">Send</button>
          </form>
        </div>
      </div>
    </main>
  );
}
