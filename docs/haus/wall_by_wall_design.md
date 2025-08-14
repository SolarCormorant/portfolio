---
id: wall_by_wall
title: Wall By Wall Design
sidebar_position: 1
custom_edit_url: null
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import VideoPlayer from '@site/src/components/VideoPlayer';

- Most decisions are automated, like the type of block used or where the block should be placed if another block has already made that decision,  allowing the user to focus on high-level choices such as block placement and block type selection.

- All UI options are color-coded to match their corresponding elements in the model. This eliminates the need for arbitrary labels or naming conventions, which can become unclear depending on view angle or context, and ensures an intuitive and visually consistent design experience.

## Corners

The type of corner condition is automatically detected and reflected in the UI, allowing the user to choose only the apropriate block type. The algorithm handles a range of scenarios to ensure accurate and context-sensitive placement:


If the connection involves a load-bearing wall, the algorithm adapts the block placement to meet structural conditions.
<Tabs groupId="blockCorner">
  <TabItem value="closedCorner" label="Closed Corner">
  - If no connecting wall is detected, the corner is automatically closed.

<VideoPlayer src="/video/haus/corner_0.mp4" />

  </TabItem>
  <TabItem value="openCorner" label="Open Corner">
  - If a connecting wall is detected, the corner is automatically opened.

  <VideoPlayer src="/video/haus/corner_1.mp4" />

  </TabItem>
  <TabItem value="existingCornerBlock" label="Existing Corner">
    - If a connecting wall and a corner block already exists, it is recognized and the placement is adjusted accordingly.

  <VideoPlayer src="/video/haus/corner_2.mp4" />

  </TabItem>
  <TabItem value="connectingWallBlock" label=" Connecting Wall Corner">
    - If the wall ıs a connecting wall, and there is a connecting wall, it is recognized the placement is adjusted accordingly.

  <VideoPlayer src="/video/haus/corner_3.mp4" />

  </TabItem>
    
</Tabs>

## Connecting Walls
    - If there is a connecting load-bearing wall, the algorithm recognizes it and adjusts the placement accordingly.
    - There are  three position options for three blocks but the perpendicular has the most priority after the +X side and lastly -X has no options but the last remaining option. 

<VideoPlayer src="/video/haus/connection_0.mp4" />


## Frame Blocks
    If a corner block already exists, the algorithm recognizes it and adjusts the placement accordingly.
<VideoPlayer src="/video/haus/frame_0.mp4" />


## Column Blocks

  The algorithm automatically detects the position of the column blocks based on the guide curve and adjusts their placement accordingly.

## Filler Blocks

## Optimization of Palette Number

-  Normally only 