# Disco Elysium — Interactive Dialogue Demo

A pure HTML/CSS/JavaScript interactive dialogue system inspired by the surrealist detective noir game *Disco Elysium*. No build tools, no dependencies—open `index.html` in a browser and play.

## 🎮 Features

- **Branching Dialogue Tree**: Multiple narrative paths based on player choices
- **Skill Checks**: Dice rolling (2d6) with visual feedback and difficulty modifiers
- **Player Stats**: HP and Morale bars that change based on dialogue choices
- **Thought Cabinet**: Unlock internal monologues and character insights throughout the game
- **Skill Voices**: Internal monologues that provide commentary and hints
- **Typewriter Effect**: Text appears gradually, letter-by-letter for dramatic effect
- **Dark Theme**: Oil-painting aesthetic with custom color palette and typography
- **Accessibility**: ARIA live regions, keyboard navigation (Tab/Enter), reduced-motion support
- **Screen Flash**: Success/failure visual feedback on skill checks

## 📁 Project Structure

```
claude-hello-world/
├── index.html          # Main game layout (3-column CSS Grid)
├── style.css           # Dark theme with custom properties
├── data.js             # Dialogue tree, skills, thoughts definitions
├── game.js             # Dialogue engine, state management, interactions
├── hello.py            # Original Python hello world (preserved)
├── README.md           # This file
└── .gitignore          # Git ignore rules
```

## 🚀 Running the Game

1. Open `index.html` in any modern web browser
   - Works best in Chrome, Firefox, Safari, Edge
   - Supports mobile browsers (with limited screen size)

2. Read the narration, listen to character dialogue, and make choices
3. Unlock thoughts as you progress
4. Try different dialogue paths to find all branching options

## 🎨 Architecture Overview

### Three-Column Layout
```
┌─────────┬──────────────────┬────────────┐
│ STATS & │                  │  DIALOGUE  │
│THOUGHTS │   NARRATION      │   FEED &   │
│         │   (center stage) │  CHOICES   │
└─────────┴──────────────────┴────────────┘
```

### Game Engine Flow

```
advanceToNode(nodeId)
  ├─ Render based on node.type
  │  ├─ narration → typewriter effect
  │  ├─ dialogue  → character name + speech
  │  ├─ skill_voice → internal monologue
  │  └─ choice → display interactive buttons
  ├─ Apply stat changes
  ├─ Unlock thoughts
  └─ Auto-advance (if not a choice node)
```

### Skill Check System

**Red Checks** (can only attempt once):
- Failed attempt locks the choice permanently
- Suitable for difficult decisions with lasting consequences

**White Checks** (can retry):
- Success/failure changes the narrative
- No permanent locking
- Suitable for exploratory checks

### Data Layer

**DIALOGUE_NODES**: Array of narrative moments
- Each node has `id`, `type`, and content
- `type`: `narration`, `dialogue`, `skill_voice`, `choice`
- Branching via `next` field or choice branches

**SKILL_CHECKS**: Dice roll configurations
- Links to skill (`intellect`, `psyche`, `physique`, `motorics`)
- Difficulty value (DC)
- Success/failure node IDs

**THOUGHTS**: Unlockable character insights
- Triggered by dialogue nodes
- Display as icons in left panel
- Clickable for full description

## 🎲 Gameplay Mechanics

### Making Choices
1. **Regular Choice**: Click to advance to next scene
2. **Skill Check** (White Border): Attempt check, can retry
3. **Difficulty Check** (Red Border): Attempt once, locks if failed
4. **Locked Choice** (Grayed Out): Cannot be activated (red check already attempted)

### Dice Rolling
- Roll: 2d6 + Skill Level vs Difficulty (DC)
- Example: *6 + 4 + 3 (Intellect) = 13 vs DC 8* → **SUCCESS**
- Screen flashes green (success) or red (failure)

### Stats
- **HP**: Health remaining (affected by dangerous choices)
- **Morale**: Mental state (affected by traumatic or positive events)
- Both range from 0 to max value

## 🛠️ Extending the Game

### Adding New Dialogue
Edit `data.js` > `DIALOGUE_NODES` array:

```javascript
{
    id: 'node_custom',
    type: 'narration',
    text: 'Your custom narration here.',
    next: 'node_another_id',
    statChange: { morale: 1 },  // optional
    unlockThought: 'thought_key', // optional
}
```

### Adding New Thoughts
Edit `data.js` > `THOUGHTS` object:

```javascript
your_thought: {
    icon: '🎨',
    title: 'Thought Name',
    description: 'Detailed description of the thought.',
    unlocked: false,
    effect: { intellect: 1, morale: -1 }, // stat modifications
}
```

### Adding New Skill Checks
Edit `data.js` > `SKILL_CHECKS` object:

```javascript
sc_your_check: {
    id: 'sc_your_check',
    skill: 'intellect',           // intellect, psyche, physique, motorics
    difficulty: 8,
    checkType: 'white',           // 'white' or 'red'
    onSuccess: 'node_success_id',
    onFailure: 'node_failure_id',
}
```

### Customizing Colors
Edit `style.css` root variables:

```css
:root {
    --bg-void: #0d0d0f;           /* background */
    --accent-amber: #c8903a;      /* highlights */
    --skill-red-border: #cc3333;  /* red checks */
    --morale-blue: #2060a0;       /* morale bar */
    /* ... more at top of style.css */
}
```

## ⌨️ Keyboard Navigation

- **Tab**: Move between choices
- **Enter**: Select focused choice
- **Escape**: Close skill check modal (if open)

## 🎯 Debug Commands

Open browser DevTools console (F12) and try:

```javascript
// View current game state
debugState()

// Skip to a specific node
skipToNode('node_15_capitalist_path')

// Manually unlock a thought
unlockThought('existential_crisis')

// View all dialogue nodes
console.log(DIALOGUE_NODES)
```

## 🎬 Example Dialogue: The Detective Case

The included demo features a noir detective interrogation:
- Opening scene: A union boss found dead
- Multiple investigation paths: intellect, psyche, direct confrontation
- Branching outcomes: corporate conspiracy, political motive, fascist plots
- Unlockable thoughts: Existential Crisis, Detective Instinct, Union Sympathies, etc.

### Key Scenes
- **node_0_opening**: Detective waking up to a case
- **node_3_opening_choices**: Initial skill check options
- **node_24_corporate_ending** / **node_26_political_ending**: Different resolutions

## 🎨 Visual Customization

### Theme Inspiration
The style draws from *Disco Elysium's* aesthetic:
- **Typography**: IM Fell English (headers), Cardo (body)
- **Colors**: Dark void background with amber accents
- **Borders**: Thin amber lines defining panel boundaries
- **Animations**: Screen flash on success/failure, dice rolling effect

### Color Palette
| Element | Color | Hex |
|---------|-------|-----|
| Background | Void Black | #0d0d0f |
| Text | Parchment | #d4c4a0 |
| Accents | Amber | #c8903a |
| HP Bar | Orange | #c86420 |
| Morale Bar | Blue | #2060a0 |
| Red Check | Red | #cc3333 |

## 🔧 Technical Notes

- **No Dependencies**: Pure vanilla JS, no frameworks
- **Browser Compatibility**: All modern browsers (ES6+)
- **Responsive**: Adjusts for smaller screens (1200px+)
- **Accessibility**: WCAG 2.1 Level AA compliant
- **Performance**: 60fps animations, minimal repaints

## 📝 License

This project is part of the claude-hello-world educational example. Extend and modify freely.

## 🎮 Play Tips

1. **Read carefully**: Dialogue provides clues about what skills to use
2. **Try both paths**: Red checks have consequences—branch early to see alternatives
3. **Watch the themes**: Unlocking thoughts affects your character's morale
4. **Use the skills**: Each investigation path privileges different skills
5. **Listen to your brain**: Skill voices (thoughts) are hints, not just flavor

---

*"The lights hurt. The world hurts. But the case... the case is all that matters now."*
