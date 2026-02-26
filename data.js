/* ============================================================================
   DISCO ELYSIUM — DATA LAYER
   ============================================================================ */

/* SKILLS DEFINITION */
const SKILLS = {
    intellect: { name: 'Intellect', color: '#7da3d4' },
    psyche: { name: 'Psyche', color: '#d47daa' },
    physique: { name: 'Physique', color: '#c86420' },
    motorics: { name: 'Motorics', color: '#c8903a' },
};

/* PLAYER SKILLS (current level) */
const PLAYER_SKILLS = {
    intellect: 3,
    psyche: 2,
    physique: 1,
    motorics: 2,
};

/* PLAYER STATS */
const PLAYER_STATS = {
    hp: 15,
    maxHp: 15,
    morale: 7,
    maxMorale: 10,
};

/* THOUGHTS CABINET */
const THOUGHTS = {
    existential_crisis: {
        icon: '🌑',
        title: 'Existential Crisis',
        description: 'The weight of existence itself. -1 Morale, but +1 Intellect.',
        unlocked: false,
        effect: { morale: -1, intellect: 1 },
    },
    detective_instinct: {
        icon: '🔍',
        title: 'Detective Instinct',
        description: 'You remember why you became a cop.',
        unlocked: false,
        effect: { psyche: 1 },
    },
    gutter_trash: {
        icon: '🥃',
        title: 'Gutter Trash',
        description: 'Am I human? Do I matter?',
        unlocked: false,
        effect: { morale: -2, physique: 1 },
    },
    linguistic_procrastination: {
        icon: '📖',
        title: 'Linguistic Procrastination',
        description: 'Words. Endless words. Few answers.',
        unlocked: false,
        effect: { morale: -1 },
    },
    romantic_fatigue: {
        icon: '💔',
        title: 'Romantic Fatigue',
        description: 'Love is a trap. Why do we keep falling?',
        unlocked: false,
        effect: { morale: -1 },
    },
    union_sympathies: {
        icon: '👥',
        title: 'Union Sympathies',
        description: 'The workers need protection. You remember this.',
        unlocked: false,
        effect: { psyche: 1 },
    },
};

/* SKILL CHECKS */
const SKILL_CHECKS = {
    sc_first_intuition: {
        id: 'sc_first_intuition',
        skill: 'intellect',
        difficulty: 8,
        checkType: 'white', // white or red
        onSuccess: 'node_intuit_success',
        onFailure: 'node_intuit_failure',
    },
    sc_psyche_resist: {
        id: 'sc_psyche_resist',
        skill: 'psyche',
        difficulty: 6,
        checkType: 'red',
        onSuccess: 'node_psyche_resist_success',
        onFailure: 'node_psyche_resist_failure',
    },
    sc_physique_hold: {
        id: 'sc_physique_hold',
        skill: 'physique',
        difficulty: 7,
        checkType: 'white',
        onSuccess: 'node_physique_success',
        onFailure: 'node_physique_failure',
    },
};

/* DIALOGUE NODES */
const DIALOGUE_NODES = [
    // ========== OPENING SCENE ==========
    {
        id: 'node_0_opening',
        type: 'narration',
        text: `You open your eyes to fluorescent hum. The detective's office. Dingy. Smells of stale coffee and broken promises.

A body. Found near the whirling-in-rags statue. Union boss. Shot execution-style.

Your lieutenant, Kim Kitsuragi, stands by the window. Waiting. He always waits.`,
        next: 'node_1_kim_enters',
    },

    {
        id: 'node_1_kim_enters',
        type: 'dialogue',
        character: 'Kim Kitsuragi',
        text: 'We have a case. The union workers are getting restless. The victim—Iosef Lilianovich Dros—ran this district with an iron fist.',
        next: 'node_2_skill_voice',
    },

    {
        id: 'node_2_skill_voice',
        type: 'skill_voice',
        skill: 'intellect',
        text: '[Intellect - 3] The unions never liked him. You remember the grievances filed last year. How many?',
        next: 'node_3_opening_choices',
    },

    {
        id: 'node_3_opening_choices',
        type: 'choice',
        text: 'How do you respond?',
        choices: [
            {
                text: '[Intellect 8] Analyze the scene carefully for clues.',
                skillCheck: 'sc_first_intuition',
                type: 'white',
                choice_id: 'choice_analyze',
            },
            {
                text: '[Psyche 6] Feel out if Kim is hiding something from me.',
                skillCheck: 'sc_psyche_resist',
                type: 'red',
                choice_id: 'choice_feel_out',
            },
            {
                text: 'Ask Kim directly: "Who wanted him dead?"',
                next: 'node_4_direct_question',
                choice_id: 'choice_direct',
            },
        ],
    },

    // ========== INTELLECT PATH ==========
    {
        id: 'node_intuit_success',
        type: 'skill_voice',
        skill: 'intellect',
        text: '[Success] Something nags at you. Entry wounds. Professional killer. The trajectory suggests... someone from the rooftops.',
        next: 'node_5_rooftop_lead',
    },

    {
        id: 'node_intuit_failure',
        type: 'skill_voice',
        skill: 'intellect',
        text: '[Failure] You stare at the scene. Nothing. Your brain feels like wet sand.',
        next: 'node_5_rooftop_lead',
        statChange: { morale: -1 },
    },

    {
        id: 'node_5_rooftop_lead',
        type: 'dialogue',
        character: 'Kim Kitsuragi',
        text: 'The coroner found ash under the body. Cigarette ash. Not local brand.',
        next: 'node_6_rooftop_follow_up',
    },

    {
        id: 'node_6_rooftop_follow_up',
        type: 'choice',
        text: 'What do you do?',
        choices: [
            {
                text: 'Investigate the rooftops around the statue.',
                next: 'node_7_investigation_success',
                choice_id: 'choice_investigate',
            },
            {
                text: 'Confront the union workers directly.',
                next: 'node_8_union_confrontation',
                choice_id: 'choice_union',
            },
        ],
    },

    // ========== PSYCHE PATH ==========
    {
        id: 'node_psyche_resist_success',
        type: 'skill_voice',
        skill: 'psyche',
        text: '[Success] Kim\'s jaw tightens. Just for a moment. He knows something. He\'s always known.',
        next: 'node_9_kim_admits',
        statChange: { morale: 1 },
        unlockThought: 'detective_instinct',
    },

    {
        id: 'node_psyche_resist_failure',
        type: 'skill_voice',
        skill: 'psyche',
        text: '[Failure] Kim meets your eyes with that cop stare. Flat. Unreadable. Is anyone ever truly readable?',
        next: 'node_10_kim_silent',
        statChange: { morale: -2 },
    },

    {
        id: 'node_9_kim_admits',
        type: 'dialogue',
        character: 'Kim Kitsuragi',
        text: 'There\'s something else. Anti-capitalist literature was found in the victim\'s office. Pamphlets about collective ownership. He was... conflicted.',
        next: 'node_11_union_sympathies_reveal',
    },

    {
        id: 'node_10_kim_silent',
        type: 'narration',
        text: 'Kim turns back to the window. The silence stretches like wet rubber.',
        next: 'node_4_direct_question',
    },

    {
        id: 'node_11_union_sympathies_reveal',
        type: 'skill_voice',
        skill: 'psyche',
        text: '[Psyche - 2] The union movement. Workers demanding respect. Things could change.',
        next: 'node_12_choose_path',
        unlockThought: 'union_sympathies',
    },

    // ========== DIRECT QUESTION PATH ==========
    {
        id: 'node_4_direct_question',
        type: 'dialogue',
        character: 'Detective (You)',
        text: '"Who wanted him dead? And don\'t give me the corporate line."',
        next: 'node_13_kim_response',
    },

    {
        id: 'node_13_kim_response',
        type: 'dialogue',
        character: 'Kim Kitsuragi',
        text: '"That\'s what we\'re here to find out. But I can tell you this—the unions aren\'t happy about the wage cuts."',
        next: 'node_14_wage_cuts_angle',
    },

    {
        id: 'node_14_wage_cuts_angle',
        type: 'choice',
        text: 'So the motive is money?',
        choices: [
            {
                text: 'Yes. Follow the money, always.',
                next: 'node_15_capitalist_path',
                choice_id: 'choice_capital',
            },
            {
                text: 'No. This is ideology. Political.',
                next: 'node_16_political_path',
                choice_id: 'choice_politics',
            },
        ],
    },

    // ========== INVESTIGATION SUCCESS ==========
    {
        id: 'node_7_investigation_success',
        type: 'narration',
        text: 'You climb the metal staircase to the warehouse roof. Wind howls. There—a spent casing. Rifling marks match a military-grade pistol.',
        next: 'node_17_military_connection',
        statChange: { morale: 2 },
        unlockThought: 'detective_instinct',
    },

    {
        id: 'node_17_military_connection',
        type: 'skill_voice',
        skill: 'intellect',
        text: '[Intellect - 3] Military hardware. This wasn\'t union muscle. This was someone trained. Professional. Someone from outside.',
        next: 'node_18_military_choice',
    },

    {
        id: 'node_18_military_choice',
        type: 'choice',
        text: 'Who has access to military weapons?',
        choices: [
            {
                text: 'Corporate security. They have the resources.',
                next: 'node_19_corporate_conspiracy',
                choice_id: 'choice_corporate',
            },
            {
                text: 'Fascist paramilitaries. I\'ve heard rumors.',
                next: 'node_20_fascist_angle',
                choice_id: 'choice_fascist',
            },
        ],
    },

    // ========== UNION CONFRONTATION ==========
    {
        id: 'node_8_union_confrontation',
        type: 'narration',
        text: 'You find them at the union hall. Angry. Grieving in their own way. Dros was one of them, despite everything.',
        next: 'node_21_union_reaction',
    },

    {
        id: 'node_21_union_reaction',
        type: 'dialogue',
        character: 'Union Worker (Cuno)',
        text: '"Cop. You still don\'t get it, do you? This was a hit. Someone wanted him gone. Someone powerful."',
        next: 'node_22_union_intel',
    },

    {
        id: 'node_22_union_intel',
        type: 'skill_voice',
        skill: 'psyche',
        text: '[Psyche - 2] These people. They\'re scared. Not of the police. Of something bigger. Something they can\'t name.',
        next: 'node_23_final_choice',
    },

    // ========== CAPITALIST PATH ==========
    {
        id: 'node_15_capitalist_path',
        type: 'narration',
        text: 'Follow the accounts. The money always tells the story. Dros was embezzling from the corporation. They found out.',
        next: 'node_24_corporate_ending',
    },

    {
        id: 'node_24_corporate_ending',
        type: 'dialogue',
        character: 'Kim Kitsuragi',
        text: '"The corporation denies everything. But we have evidence. It\'s enough to bring someone in for questioning."',
        next: 'node_25_closing',
        statChange: { morale: 1 },
    },

    // ========== POLITICAL PATH ==========
    {
        id: 'node_16_political_path',
        type: 'narration',
        text: 'Dros was becoming sympathetic to the union cause. Dangerous. Someone needed him silenced before he could turn.',
        next: 'node_26_political_ending',
        unlockThought: 'union_sympathies',
    },

    {
        id: 'node_26_political_ending',
        type: 'dialogue',
        character: 'Kim Kitsuragi',
        text: '"You might be right. The timing is suspicious. A week before the wage negotiation vote."',
        next: 'node_25_closing',
        statChange: { morale: 2 },
    },

    // ========== CORPORATE CONSPIRACY ==========
    {
        id: 'node_19_corporate_conspiracy',
        type: 'narration',
        text: 'The pieces fall into place. Corporate hired a freelancer. Professional. Untraceable. It\'s the perfect crime.',
        next: 'node_27_corporate_suspect',
    },

    {
        id: 'node_27_corporate_suspect',
        type: 'dialogue',
        character: 'Kim Kitsuragi',
        text: '"We need warrants for the corporate headquarters. This could take weeks."',
        next: 'node_25_closing',
        statChange: { morale: 1 },
    },

    // ========== FASCIST ANGLE ==========
    {
        id: 'node_20_fascist_angle',
        type: 'narration',
        text: 'Political extremists. The kind that operate in the shadows. The kind that terrify governments.',
        next: 'node_28_fascist_suspect',
        unlockThought: 'existential_crisis',
    },

    {
        id: 'node_28_fascist_suspect',
        type: 'dialogue',
        character: 'Kim Kitsuragi',
        text: '"That\'s... a dangerous direction to go. But you might be onto something."',
        next: 'node_25_closing',
        statChange: { morale: -1 },
    },

    // ========== FINAL CHOICE POINT ==========
    {
        id: 'node_12_choose_path',
        type: 'choice',
        text: 'Where does your investigation lead?',
        choices: [
            {
                text: 'Press the union workers more aggressively.',
                next: 'node_8_union_confrontation',
                choice_id: 'choice_press_union',
            },
            {
                text: 'Examine the crime scene more carefully.',
                next: 'node_7_investigation_success',
                choice_id: 'choice_examine_scene',
            },
        ],
    },

    {
        id: 'node_23_final_choice',
        type: 'choice',
        text: 'What\'s your next move?',
        choices: [
            {
                text: 'Find out who has military connections.',
                next: 'node_18_military_choice',
                choice_id: 'choice_military_leads',
            },
            {
                text: 'Ask more about the embezzlement.',
                next: 'node_15_capitalist_path',
                choice_id: 'choice_money_trail',
            },
        ],
    },

    // ========== CLOSING ==========
    {
        id: 'node_25_closing',
        type: 'narration',
        text: `The case feels solved. Or perhaps just papered over. The body is zipped in a bag. The case file grows thicker with each question answered.

Will it matter? Will Iosef Lilianovich Dros stay dead, or will he haunt you in the years to come?

Kim looks at you with something like respect. Or pity. Hard to tell the difference anymore.`,
        next: null,
    },
];

// Verify node integrity
function validateDialogueNodes() {
    const nodeIds = new Set(DIALOGUE_NODES.map(n => n.id));
    const issues = [];

    DIALOGUE_NODES.forEach(node => {
        if (node.next && !nodeIds.has(node.next) && node.next !== null) {
            issues.push(`Node ${node.id} references unknown next: ${node.next}`);
        }
        if (node.type === 'choice' && node.choices) {
            node.choices.forEach((choice, idx) => {
                if (choice.next && !nodeIds.has(choice.next)) {
                    issues.push(`Node ${node.id} choice ${idx} references unknown next: ${choice.next}`);
                }
                if (choice.skillCheck) {
                    if (!SKILL_CHECKS[choice.skillCheck]) {
                        issues.push(`Node ${node.id} choice ${idx} references unknown skill check: ${choice.skillCheck}`);
                    }
                }
            });
        }
    });

    if (issues.length > 0) {
        console.warn('Dialogue validation issues:', issues);
    }
    return issues.length === 0;
}

// Run validation on load
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', validateDialogueNodes);
}
