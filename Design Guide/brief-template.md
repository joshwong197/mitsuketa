# Design brief template

Use this template for `design-brief.md`. Keep it specific enough for an independent builder and critic to reach the same conclusion.

## 1. Context observed

- Product and surface:
- Repository or existing interface reviewed:
- Existing brand and content sources:
- Technical, legal, or delivery constraints:

## 2. Questions and assumptions

### Blocking questions

Ask only questions that alter structure, message, visual direction, or release requirements.

| Question | Why it changes the work | Answer or owner |
| --- | --- | --- |
| Primary user and primary action? | Determines hierarchy and interaction | |
| Required content, data, and claims? | Prevents invented interface content | |
| Brand material and forbidden territory? | Defines recognisable identity and boundaries | |
| Success measure and launch scope? | Sets the practical quality bar | |

### Safe assumptions

| Assumption | Reason | Requires confirmation by |
| --- | --- | --- |
| | | |

## 3. Product intent

- Target user and situation:
- Primary job to be done:
- Primary action or decision:
- Secondary actions:
- Message hierarchy:
- Success evidence:

## 4. Design direction

- Direction name:
- Emotional aim:
- Anti-aim, what the work must never feel like:
- Visual thesis in one paragraph:
- Quality baseline, supplied references or agreed comparables:

### Visual grammar

| Area | Decision | Reason |
| --- | --- | --- |
| Composition | | |
| Typography | | |
| Palette and contrast | | |
| Spacing and density | | |
| Borders, elevation, and texture | | |
| Imagery and icons | | |
| Motion | | |
| Mobile behavior | | |

### Explicit exclusions

List patterns, elements, and claims excluded from this surface. Include the reason for each.

## 5. Required experience

- Required states: default, loading, empty, error, success, long content, permission or edge cases
- Accessibility: contrast, focus, keyboard, screen reader, text resizing, reduced motion
- Performance and asset budget:
- Content owner and copy approval:
- Analytics or experiment events:

## 6. Acceptance criteria

| Criterion | Evidence required |
| --- | --- |
| The primary action is discoverable at target widths | Screenshot and manual path test |
| The visual system expresses the approved direction | Critic review against baseline |
| Content is truthful and approved | Source or owner approval |
| Core accessibility and responsive states work | Test results and screenshots |
| No unresolved high-severity issues remain | Issue list or explicit waiver |

## Direction exploration prompt

Use this before implementation:

> Produce five distinct visual directions for [surface] serving [user] who needs to [job]. Each direction must use a different composition, typographic voice, imagery strategy, and interaction character. Work from these facts: [facts]. Respect these constraints: [constraints]. For each direction, explain the user effect, practical risks, accessibility implications, and patterns to avoid. Do not create code. Seek a strong point of view without weakening comprehension.

## Seed-string prompt

Use this only to widen the search space:

> Generate a long random alphanumeric string. Read it privately for visual subpatterns, rhythm, density, contrast, sequence, or structure. Translate those observations into an original design direction for [surface]. Do not reveal the string or use it in copy, labels, or product data. Explain the resulting visual decisions and why they suit the product.
