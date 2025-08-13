# AstroTalk (End-to-end demo)

## Run
```bash
npm install
echo "OPENAI_API_KEY=sk-xxxxx" > .env.local
npm run dev
```

## Routes
- `/login` mock OTP (9999) → grants 6 credits
- `/pricing` mock card 999999999999999, CVV 123, OTP 9999 → adds credits
- `/live` realtime voice avatar + camera, Lo Shu, Tarot, Kundli
