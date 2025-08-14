---
id: automated_design
title: Automated Design
sidebar_position: 2
custom_edit_url: null
---

import VideoPlayer from '@site/src/components/VideoPlayer';

- In the second phase, the algorithm evaluates the entire building automatically, without requiring any human input.

- The optimization process is driven by a set of objective functions, including:

    - Minimizing the total number of palettes used

    - Ensuring block overlaps remain below a defined threshold

    - Reducing the number of cut blocks required

- This phase enables large-scale, production-aware optimization while preserving design intent.

<VideoPlayer src="/video/haus/for_tadas_with_love.mp4" />


## The Problem
- Number of filler blocks are constantly changing based on other block choices and therefore number of inputs are constantly changing. Therefore the traditional evolutionary algorithms are not suitable for this task and I havent found a solution for it yet. However if you feel patient and lucky enough you can get some good results by randomizing the inputs. 


