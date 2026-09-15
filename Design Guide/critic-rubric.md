# Independent critic rubric

Use this after a direction has been approved and a working interface can be rendered. Evaluate screenshots in a fresh context.

## Critic inputs

Provide:

- the approved design brief
- reference images or an agreed quality baseline
- screenshots at target mobile and desktop sizes
- product constraints that affect the result

Withhold source code, build notes, prior critique, and the implementer's explanation.

## Critic prompt

> You are the independent visual critic for this product surface. Review the supplied screenshots against the approved design brief and reference baseline. Judge the intended aesthetic as a top product design studio would execute it. Evaluate structure before ornament, then typography, color, imagery, interaction cues, mobile behavior, and fine detail. Identify the five largest gaps, explain their effect on the user, and give exact changes in priority order. Penalize generic AI-produced patterns only when they weaken this product's distinct direction. Score each category from 1 to 5 and give a short reason. Do not infer effort from the implementation. Do not redesign the product into a different aesthetic.

## Scorecard

| Category | What to judge |
| --- | --- |
| Purpose and hierarchy | Can the user immediately see what this surface is for, what matters, and what to do next? |
| Composition and density | Does the layout control attention, spacing, rhythm, alignment, and screen space with confidence? |
| Typography and copy fit | Is the type hierarchy deliberate, readable, and matched to the product voice? Does copy sound human and truthful? |
| Visual identity | Do palette, texture, shape, imagery, and component rules form one recognisable point of view? |
| Interaction and states | Are controls legible, states clear, and feedback proportionate? |
| Responsive and accessible quality | Does the work hold together on target sizes and under keyboard, contrast, zoom, and reduced-motion checks? |
| Craft | Are details coherent, assets well-integrated, and rough edges removed? |

Treat scores below 3 as release blockers unless an explicit product trade-off exists. Explain any discrepancy between a high overall score and a serious usability issue.

## AI-fingerprint review

Review these patterns after a coherent direction exists. Require a reason for any that remain. Their presence alone does not prove poor design.

- Generic hero copy on the left with a decorative illustration on the right
- Gradient aurora, glass blur, glow, mesh, or floating particle decoration
- Repeated rounded cards, bento grids, pills, badges, and arbitrary labels
- Oversized headline followed by a vague promise and generic CTA
- Random accent colors, sparkles, icons, charts, or ornamental shapes
- Excessive border radius, low-contrast text, shadows, and nested containers
- Feature sections that repeat the same geometry and wording
- Placeholder testimonials, invented customer logos, unsupported metrics, or false urgency
- Decorative image generation with no relationship to the content
- Motion that delays reading, competes with primary actions, or ignores reduced-motion preferences
- Walls of AI-written copy, empty adjectives, fake specificity, and repeated claims

For each material pattern, ask: What job does it perform here? Does a simpler, more specific alternative serve that job better? Remove elements that lack an answer.

## Release check

Before shipping, verify:

- screenshots at agreed mobile and desktop widths
- keyboard-only navigation and visible focus
- contrast, text resizing, meaningful labels, and reduced motion
- default, loading, empty, error, success, long-content, and disabled states where relevant
- real or approved copy, names, data, testimonials, and claims
- asset crops, fallbacks, file weight, and image rights
- primary action and product analytics events
- no visual regression against the approved design contract

Record the screenshots, checks, unresolved risks, and human approval with the delivery summary.
