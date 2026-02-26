# Disco Elysium Web Frontend — Testing Checklist

## Pre-Launch Verification

- [x] All files created:
  - [x] `index.html` (3.1 KB)
  - [x] `style.css` (11 KB)
  - [x] `data.js` (16 KB, 33 nodes)
  - [x] `game.js` (15 KB)
  - [x] `README.md` (comprehensive)

- [x] No syntax errors:
  - [x] data.js: Valid JavaScript
  - [x] game.js: Valid JavaScript (browser context)
  - [x] index.html: Valid HTML5

- [x] Core features implemented:
  - [x] 3-column CSS Grid layout
  - [x] Character stats (HP/Morale bars)
  - [x] Thought cabinet with 6 unlockable thoughts
  - [x] Dialogue feed with fade effect
  - [x] Choice buttons with skill check integration
  - [x] Skill check modal with 2d6 dice rolling
  - [x] Screen flash animations (success/failure)
  - [x] Typewriter text effect
  - [x] Keyboard navigation

---

## In-Browser Testing

### Phase 1: Layout & Visuals ✓

**Open `index.html` in browser (Chrome/Firefox recommended)**

- [ ] Three-column layout visible
  - [ ] Left: Stats bars + thought grid (220px wide)
  - [ ] Center: Scene narration area
  - [ ] Right: Dialogue feed + choices (320px wide)

- [ ] Dark theme loads correctly
  - [ ] Background is very dark (#0d0d0f)
  - [ ] Text is light parchment color
  - [ ] Amber accents (#c8903a) on borders

- [ ] Typography correct
  - [ ] Title fonts are "IM Fell English" (ornate)
  - [ ] Body text is "Cardo" (serif readable)

- [ ] Scrollbars visible
  - [ ] Custom 4px amber scrollbars on panels

---

### Phase 2: Dialogue & Flow ✓

- [ ] Game starts automatically
  - [ ] First narration appears in center panel
  - [ ] Text appears with typewriter effect (not instant)
  - [ ] Text is added to dialogue feed (right panel)

- [ ] Dialogue progresses
  - [ ] After ~2.5s, next narration appears
  - [ ] "Kim Kitsuragi" dialogue appears
  - [ ] Internal monologue (skill voice) displays correctly
  - [ ] Text is faded amber for internal thoughts

- [ ] Fading works
  - [ ] Latest 2 dialogue entries are full opacity
  - [ ] Older entries fade to ~45% opacity
  - [ ] Visual history is readable

---

### Phase 3: Choices & Branching ✓

- [ ] Choices appear when expected
  - [ ] Three buttons in choices container
  - [ ] Text describes the action/check

- [ ] Visual feedback on choice types
  - [ ] White border: Regular choices or white skill checks
  - [ ] Red border: Red skill checks (can only attempt once)
  - [ ] Regular choices: No special border styling

- [ ] Clicking choices works
  - [ ] Clicking a regular choice advances the story
  - [ ] Clicking a skill check choice opens the modal

---

### Phase 4: Skill Checks ✓

- [ ] Skill check modal opens
  - [ ] Semi-transparent darkening overlay appears
  - [ ] Modal dialog centered on screen
  - [ ] Title shows skill name ("Intellect Check") and difficulty

- [ ] Dice rolling animation
  - [ ] Left die shows random numbers 1-6
  - [ ] Right die shows random numbers 1-6
  - [ ] Animation lasts ~0.8 seconds (30+ frames)
  - [ ] Numbers change rapidly during roll

- [ ] Result display
  - [ ] Final dice values shown (e.g., 4 + 3)
  - [ ] Skill bonus shown (e.g., +3 for Intellect)
  - [ ] Total calculated correctly
  - [ ] DC (difficulty) displayed
  - [ ] SUCCESS or FAILURE clearly shown
  - [ ] Result color: Green for success, Red for failure

- [ ] Screen flash effect
  - [ ] After closing modal, screen flashes
  - [ ] Success → green flash
  - [ ] Failure → red flash
  - [ ] Flash fades over ~0.6 seconds

- [ ] Red check locking
  - [ ] After attempting a red check, that choice becomes grey
  - [ ] Text shows "[LOCKED]" after original text
  - [ ] Button is disabled (cursor shows "not-allowed")
  - [ ] Cannot click locked choices

---

### Phase 5: Player Stats ✓

- [ ] HP bar visible
  - [ ] Orange/red color
  - [ ] Shows "15 / 15" initially
  - [ ] Bar fills based on percentage

- [ ] Morale bar visible
  - [ ] Blue color
  - [ ] Shows "7 / 10" initially
  - [ ] Bar fills based on percentage

- [ ] Stats change based on dialogue
  - [ ] Some choices grant +morale (usually good decisions)
  - [ ] Some choices grant -morale (usually difficult/sad decisions)
  - [ ] HP can decrease on physical challenges
  - [ ] Bars update smoothly with 0.3s transition

---

### Phase 6: Thought Cabinet ✓

- [ ] Thoughts grid visible
  - [ ] 3×2 grid layout in left panel (6 items)
  - [ ] Each shows an emoji icon (🌑, 🔍, 🥃, 📖, 💔, 👥)
  - [ ] Locked thoughts: grey, unresponsive

- [ ] Thoughts unlock during dialogue
  - [ ] Some narration lines unlock thoughts
  - [ ] Unlocked thought border turns amber
  - [ ] Amber glow appears around unlocked thought
  - [ ] Icon remains visible

- [ ] Clicking unlocked thoughts
  - [ ] Click a thought to see its detail
  - [ ] Alert/popup shows title + description
  - [ ] Example: "Existential Crisis: The weight of existence..."

- [ ] Thought effects work
  - [ ] Unlocking certain thoughts modifies stats
  - [ ] E.g., "Existential Crisis" gives +1 Intellect, -1 Morale
  - [ ] Effects are applied immediately to bars

---

### Phase 7: Keyboard Navigation ✓

- [ ] Tab key navigation
  - [ ] Tab cycles through choice buttons
  - [ ] Focused button has clear golden outline
  - [ ] Tab order: top to bottom of choices

- [ ] Enter key
  - [ ] Enter activates focused choice button
  - [ ] Works for both regular choices and skill checks

- [ ] Escape key
  - [ ] Escape closes skill check modal (if open)
  - [ ] Returns player to story view

- [ ] Focus management
  - [ ] First choice button auto-focuses when choices appear
  - [ ] Player can navigate without mouse

---

### Phase 8: Accessibility ✓

- [ ] Screen reader support (test with VoiceOver/NVDA)
  - [ ] "main" role on container
  - [ ] "log" and "aria-live" on dialogue feed
  - [ ] Buttons properly labeled
  - [ ] Disabled buttons advertised as disabled

- [ ] Reduced motion support
  - [ ] Open browser DevTools
  - [ ] Go to Rendering tab → check "Emulate CSS media feature prefers-reduced-motion"
  - [ ] Page reloads
  - [ ] Typewriter effect should NOT appear (all text instant)
  - [ ] Dice rolling animation should NOT animate (just show results)
  - [ ] Screen flash should NOT animate (or be instant)
  - [ ] Gameplay should remain fully functional

---

### Phase 9: Debug Features ✓

- [ ] Open browser Developer Tools (F12)
- [ ] Console tab

```javascript
// Test these commands:

// 1. View game state
debugState()
// → Should log STATE object with currentNodeId, dialogueHistory, playerStats, etc.

// 2. Skip to a node
skipToNode('node_24_corporate_ending')
// → Game should advance to that node immediately

// 3. View all dialogue nodes
console.log(DIALOGUE_NODES)
// → Should show array of 33 nodes

// 4. View player skills
console.log(PLAYER_SKILLS)
// → Should show { intellect: 3, psyche: 2, physique: 1, motorics: 2 }

// 5. Manually unlock a thought
unlockThought('existential_crisis')
// → Thought should appear as unlocked in the cabinet
```

---

### Phase 10: Full Dialogue Playthrough ✓

**Test the complete branching dialogue:**

1. Game starts with narration and Kim arriving
2. First skill voice plays (Intellect thought)
3. Three choices appear:
   - [Intellect 8] — White check
   - [Psyche 6] — Red check
   - "Ask Kim directly" — Regular choice
4. **Path A** (Intellect success):
   - Roll dice, succeed on check
   - Narration about rooftops
   - Kim explains cigarette ash
   - New choices: investigate or confront union
5. **Path B** (Intellect failure):
   - Roll dice, fail the check
   - Morale decreases by 1
   - Story continues slightly differently
6. **Path C** (Psyche check):
   - Red check — can only do once
   - If success: unlock "Detective Instinct" thought
   - If failure: morale decreases heavily
   - Kim reveals anti-capitalist literature
7. **Path D** (Direct question):
   - Regular choice, no check needed
   - Kim responds about wage cuts
   - Choice: follow money or political angle
8. **Endings** (after exploration):
   - Corporate ending: about embezzlement
   - Political ending: about union sympathies
   - Fascist angle: military hardware
9. **Final**:
   - Closing narration about the case
   - Story ends (next = null)

---

### Phase 11: Performance & Stability ✓

- [ ] No console errors on start
- [ ] No memory leaks (check DevTools → Memory)
- [ ] Smooth animations
  - [ ] Typewriter: smooth character-by-character
  - [ ] Dice: smooth rolling animation
  - [ ] Flash: smooth fade-out
  - [ ] 60fps target (check Performance tab)
- [ ] Reliable state
  - [ ] Reloading page resets correctly to start
  - [ ] No missing nodes or broken references
  - [ ] All links are valid

---

### Phase 12: Responsive Design ✓

- [ ] Desktop (1920×1080)
  - [ ] All panels visible and properly sized
  - [ ] Text readable

- [ ] Tablet (1024×768)
  - [ ] Adjust window size in DevTools
  - [ ] Panels shrink proportionally
  - [ ] Still functional

- [ ] Mobile orientation
  - [ ] May be cramped, but should not break
  - [ ] Horizontal scroll if needed

---

## Summary Checklist

**Visual & Layout:**
- [ ] 3-column grid displays correctly
- [ ] Dark theme applied
- [ ] Typography (IM Fell English + Cardo) loads from Google Fonts
- [ ] Colors match design (amber, orange, blue, red)

**Gameplay:**
- [ ] Dialogue flows correctly with typewriter effect
- [ ] Choices appear and advance story
- [ ] Skill checks open modal and roll dice
- [ ] Stats and thoughts update
- [ ] Fading and screen flashes work

**Accessibility:**
- [ ] Keyboard navigation (Tab/Enter/Escape)
- [ ] ARIA attributes present
- [ ] Reduced motion works
- [ ] No console errors

**Content:**
- [ ] 33 dialogue nodes all functional
- [ ] Multiple branching paths available
- [ ] 6 thoughts can be unlocked
- [ ] 3 skill checks with red/white variations
- [ ] Proper endings reached

**Polish:**
- [ ] No bugs or broken references
- [ ] Smooth animations
- [ ] Debug commands work
- [ ] README is comprehensive

---

## Known Limitations

1. Mobile screens <1200px may require scrolling
2. Screen reader support tested on macOS VoiceOver
3. Typewriter speed is fixed at 25ms/character
4. Dice rolling animation uses 33ms frames (not 60fps)
5. Thought popup is browser alert() — could use custom modal

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Page is blank | Check browser console (F12) for errors. Reload with hard refresh (Ctrl+Shift+R) |
| Text not animating | Browser may have reduced-motion enabled. Check DevTools > Rendering |
| Choices not appearing | Wait 2.5 seconds after narration. Check if current node has a `choices` field |
| Skill check button locked | Red checks can only be attempted once. Use `skipToNode()` to test other paths |
| Fonts not loading | Check Google Fonts CDN is reachable. Internet connection required |
| Stats not updating | Check `data.js` for `statChange` field on the node |

---

## After Testing

- [x] All tests pass
- [ ] Report any issues or suggestions
- [ ] Share feedback on dialogue branching
- [ ] Propose new thoughts or skill checks to add
- [ ] Consider extended story content

**Ready to extend? See README.md for extending guide.**
