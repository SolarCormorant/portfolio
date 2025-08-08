---
id: stair_types
title: Stair Geometry
sidebar_position: 0
---

import VideoPlayer from '@site/src/components/VideoPlayer';

## Number of Arms

- The number of arms defines the overall geometry of the staircase. 
- A setting of 0 arms creates a continuous spiral form, while higher values up to 4 arm introduce segmented arms, eventually overlapping at the start and end to form closed or complex looped configurations.

<VideoPlayer src="/video/stair/arms.mp4" />


## Stair Types

Three stair configurations are available:

- Type 1: Stairs with landings, adding a landing at every corner.
- Type 2: Stairs driven by a climb curve, with steps arrayed along the curve.
- Type 3: Stairs based on inner and outer borders, dividing the border into equal segments.

<VideoPlayer src="/video/stair/stair_type.mp4" />


### Arm-Based Constraints

Some stair types are restricted based on the number of arms:
- 0 Arm: Only Type 3 is supported. Since the stair rotates beyond 360 degrees, steps are generated through revolution rather than drawn curves.
- 1 Arm: Also limited to Type 3, since climb curve wouldnt affect step distribution and there are no corners for landings (which can be added by other means)
- 2 to 4 Arms: No restrictions — all stair types are available.

##  Landing Settings

### Type 1 Convert Arm to Landing

- Each arm can be converted into a landing by toggling its corresponding control in the UI.

<video controls autoplay muted loop playsInline width="100%">
  <source src="/video/type_1.mp4" type="video/mp4" />
</video>


### Type 1 Convert Landing to Arm

- Each landing can be turned to a arm by clicking on the respective landing toggle on the UI

<video controls autoplay muted loop playsInline width="100%">
  <source src="/video/type_1.mp4" type="video/mp4" />
</video>


### Type 2 & Type 3 Convert Steps to Landing

- Individual steps can be converted into landings by selecting them directly in the user interface.
- The total number of steps remains unchanged, but the remaining steps are resized to accommodate the new landing, maintaining the overall stair height while introducing rest areas where needed.

<video controls autoplay muted loop playsInline width="100%">
  <source src="/video/type_1.mp4" type="video/mp4" />
</video>


## Extend Stair
Each end of the stair can be independently extended or shortened, allowing for asymmetrical arm lengths and more flexible layouts.

<video controls autoplay muted loop playsInline width="100%">
  <source src="/video/type_1.mp4" type="video/mp4" />
</video>


## Edge Fillets
Edges can be customized with variable fillet values, ranging from subtle curves to a full round, or kept sharp based on design intent.


<VideoPlayer src="/video/stair/fillet_edge.mp4" />

