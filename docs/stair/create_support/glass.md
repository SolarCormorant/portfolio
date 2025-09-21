---
id: glass
title: Glass Properties
sidebar_position: 3
custom_edit_url: null
---

import VideoPlayer from '@site/src/components/VideoPlayer';

## Glass Division 

- Glass panels are first segmented at points of geometric discontinuity — specifically, where the curve type changes (e.g., from arc to line or line to arc) **for flow-type supports**, and at corner start points **for cornered-type supports**. These transition points define the initial split boundaries.
    
- The resulting segments are then subdivided based on a user-defined maximum panel length. The algorithm prioritizes maximizing the length of linear segments, as flat glass is more cost-efficient and simpler to fabricate than curved glass.


<VideoPlayer src="/video/stair/glass_division.mp4" />

## Types of Glass Installation

- There are two types of glass installation:
  - **Inset glass**, which fits within the support system and requires a **double-wall** configuration and supported by a inner plate that is part of the support structure.

  - **Externally mounted glass**, which is attached using rotules, with support by rotules connecting to support with more flexible options for hole location or without a support by rotules connecting to the extension of step created by nosing. 
<VideoPlayer src="/video/stair/glass.mp4" />

## Feeling Designer
- In **Feeling Designer** mode, glass panels can be redrawn manually, and division curves can be added, removed, or adjusted. This allows for greater flexibility in defining custom cut lines and tailoring the design to aesthetic or fabrication preferences.

<VideoPlayer src="/video/stair/glass_feeling_designer.mp4" />

<details>
  <summary>How does it work?</summary>
  <img src="/svg/create_beam.svg" alt="Create Custom Glass Panels" />
  </details>

## Glass Unfold
- As soon as the glass panels are defined, a 2D unfolded drawing of each panel is generated dynamically, assisting in documentation and design evaluation.
<VideoPlayer src="/video/stair/glass_feeling_designer.mp4" />

<details>
  <summary>How does it work?</summary>
  <img src="/svg/create_beam.svg" alt="Create Custom Glass Panels" />
  </details>

