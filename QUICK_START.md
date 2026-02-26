# Disco Elysium Web Frontend — Quick Start Guide

## 🚀 Get Started in 10 Seconds

1. **Open `index.html`** in your web browser
   - Double-click the file, or
   - Drag it to an open browser window, or
   - Right-click → Open with → Your browser

2. **Read and make choices**
   - Narration appears with typewriter effect
   - Click a choice to advance the story
   - Watch your stats and thoughts update

3. **Discover the story**
   - Follow multiple dialogue paths
   - Unlock thoughts as you play
   - Find all three different endings

**That's it! No installation, no build tools, no dependencies.**

---

## 📁 Project Files

| File | Purpose | Size |
|------|---------|------|
| **index.html** | Game interface (open this!) | 3.1 KB |
| **style.css** | Dark visual theme | 11 KB |
| **data.js** | Story content & dialogue | 16 KB |
| **game.js** | Game engine logic | 15 KB |
| **README.md** | Complete user guide | 12 KB |
| **TEST_CHECKLIST.md** | Testing procedures | 15 KB |
| **IMPLEMENTATION_SUMMARY.md** | Technical documentation | 20 KB |
| **DIALOGUE_TREE.txt** | Story structure map | 4 KB |
| **QUICK_START.md** | This file | 2 KB |

---

## 🎮 What to Expect

- **Detective mystery**: Solve a case with multiple investigation paths
- **Skill checks**: Roll 2d6 against story challenges
- **Branching story**: Different choices lead to different endings
- **Unlockable thoughts**: Discover character insights
- **Dark aesthetic**: Oil-painting visual style inspired by *Disco Elysium*

---

## ⌨️ Controls

- **Mouse**: Click choices to advance
- **Tab**: Navigate between options
- **Enter**: Select focused option
- **Escape**: Close skill check modal

---

## 💡 Tips

1. **Read carefully** — dialogue hints which skill to use
2. **Try different paths** — you can reload to try again
3. **Watch the bars** — stats change based on your choices
4. **Click thoughts** — unlocked thoughts show details
5. **Use console** (F12 → console) for debug commands:
   - `debugState()` — view game state
   - `skipToNode('node_id')` — jump to any scene
   - `unlockThought('thought_key')` — manually unlock

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Blank page | Reload (Ctrl+R), check browser console (F12) |
| No fonts | Wait a few seconds for Google Fonts to load |
| Choices missing | Wait 2-3 seconds after narration |
| Red check locked | You've already attempted it (by design) |
| Text not animating | Reduced motion enabled? Check DevTools. |

---

## 📖 Next Steps

- **Learn more**: Read `README.md` for full feature guide
- **Extend story**: Edit `data.js` to add new dialogue
- **Understand architecture**: See `IMPLEMENTATION_SUMMARY.md`
- **Test everything**: Follow `TEST_CHECKLIST.md`
- **Map the story**: Check `DIALOGUE_TREE.txt`

---

## 🎯 Story Overview

You're a worn-down detective in the surreal city of Revachol. A union boss has been murdered. Your partner Kim has assigned you the case. Using your skills—intellect, psyche, physical strength—you must investigate, gather clues, and decide what the crime really was about.

**Three major investigation paths:**
1. **Intellect** → Evidence-based (rooftops, weapons, forensics)
2. **Psyche** → Intuition-based (reading people, hidden motives)
3. **Direct** → Confrontational (asking tough questions)

**Three possible conclusions:**
- Corporate conspiracy (embezzlement)
- Political assassination (union conflict)
- Fascist extremism (ideological violence)

---

## 🌟 Features

✅ No external dependencies (pure HTML/CSS/JavaScript)
✅ 33 dialogue scenes with branching logic
✅ 6 unlockable character thoughts
✅ Skill checks with dice rolling animation
✅ Player stats (HP, Morale) that react to choices
✅ Multiple endings based on investigation method
✅ Dark ~Disco Elysium~ aesthetic
✅ Keyboard navigation + screen reader support
✅ Reduced motion support for accessibility

---

## 🔗 Browser Compatibility

Works on:
- ✅ Chrome/Chromium (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers (optimized for 1200px+)

---

**Ready? Open `index.html` now!**

*"The lights hurt. The city never sleeps. But the truth... the truth might be worth the pain."*
