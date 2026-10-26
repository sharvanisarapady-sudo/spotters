import { useCallback, useEffect, useRef, useState } from 'react';

const Recognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const ERROR_MESSAGES = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser, or type your answer instead.',
  'service-not-allowed': 'Voice input is not allowed in this browser. Please type your answer.',
  'no-speech': 'No speech was detected. Try again or type your answer.',
  'audio-capture': 'No microphone was found. Please type your answer.',
  network: 'Voice recognition needs a network connection. Please type your answer.',
};

/**
 * Browser speech-to-text (Web Speech API). `supported` is false in browsers
 * without it (e.g. Firefox) — callers should then hide voice input.
 * `onFinalText(text)` fires once per finished utterance.
 */
export default function useSpeechRecognition({ onFinalText, lang = 'en-US' } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef(null);
  const cbRef = useRef(onFinalText);
  cbRef.current = onFinalText;

  useEffect(() => () => recRef.current?.abort(), []);

  const start = useCallback(() => {
    if (!Recognition || recRef.current) return;
    setError('');
    setInterim('');
    const rec = new Recognition();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) cbRef.current?.(finalText.trim());
    };
    rec.onerror = (e) => {
      if (e.error !== 'aborted') setError(ERROR_MESSAGES[e.error] || 'Voice input failed. Please type your answer.');
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim('');
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      setError('Voice input could not start. Please type your answer.');
    }
  }, [lang]);

  const stop = useCallback(() => recRef.current?.stop(), []);

  return { supported: !!Recognition, listening, interim, error, start, stop };
}
