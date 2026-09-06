// Clearer American English pronunciation using the best voice available on the device.
(function () {
  const synth = window.speechSynthesis;
  if (!synth) return;

  const preferredVoiceNames = [
    /Google US English/i,
    /Microsoft.*(Aria|Jenny|Guy).*English \(United States\)/i,
    /Microsoft.*English.*United States/i,
    /Samantha/i,
    /Alex/i,
    /Karen/i,
    /Ava.*English.*United States/i,
    /Zoe.*English.*United States/i
  ];

  function getVoices() {
    return synth.getVoices().filter(v => /^en[-_]US$/i.test(v.lang));
  }

  function pickVoice() {
    const voices = getVoices();
    if (!voices.length) return null;

    for (const pattern of preferredVoiceNames) {
      const match = voices.find(v => pattern.test(v.name));
      if (match) return match;
    }

    // Prefer a local US English voice over another English locale.
    return voices.find(v => v.localService) || voices[0];
  }

  window.speak = function (word) {
    if (!word) return;

    const speakNow = () => {
      const utterance = new SpeechSynthesisUtterance(String(word).trim());
      utterance.lang = 'en-US';
      utterance.voice = pickVoice();
      utterance.rate = 0.76;
      utterance.pitch = 1;
      utterance.volume = 1;
      synth.cancel();
      synth.speak(utterance);
    };

    // Some mobile browsers populate the voice list asynchronously.
    if (getVoices().length) {
      speakNow();
    } else {
      setTimeout(speakNow, 150);
    }
  };

  // Trigger voice loading on browsers that populate voices lazily.
  synth.getVoices();
})();
