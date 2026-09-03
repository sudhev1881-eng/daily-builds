# Catch Me If You Can — Interactive Alarm

A game-like alarm clock. Set a time, arm it, then catch a runaway STOP button and survive a trick-question streak.

Rage-bait dialogue is in **Malayalam**. Personality jokes are in **English**.

```bash
cd alarm
npm install
npm run dev
```

Open the printed local URL. Use **Wake me in 10 seconds** to try the full loop immediately.

For the first **60 seconds** after the alarm rings, STOP ALARM cannot be caught — every try is a spoken Malayalam troll. After that minute, the button can actually be stopped. The ringtone is a barking dog. Trolls are read out loud.

Demo shortcuts:

- `?demo=armed` — countdown dashboard
- `?demo=armed-soon` — intense “alarm soon” card
- `?demo=ring` — chase mode (button already catchable)
- `?demo=locked` — chase mode with the 1-minute unstoppable lock
- `?demo=panic` — panic mode under 30s
- `?demo=challenge` — quiz
- `?demo=win` — victory
