---
id: optimisation-thesis
title: Optimisation Results
custom_edit_url: null

---


import Scatter3D from '@site/src/components/Scatter3D_PCP';

- The analysis was conducted across six different room configurations with a 9.9 million member search space, each with varying depths and window-to-wall ratios (WWR). As expected, there is a clear inverse relationship between heating/cooling loads and between UDI-a (Useful Daylight Illuminance) and artificial lighting loads.

- Although some solutions were not strictly dominated, several performed worse than the base case without light shelves. To refine the result set, an alternative solution set was created—containing only those options that outperformed the base case across all objectives.

- An interactive scatter plot visualizes the full search space, the Pareto front, and the five top-performing solutions for each objective. Users can click on individual points to explore associated design parameters.

- A Parallel Coordinates Plot further supports analysis by allowing users to filter solutions based on both objective values and design parameters, making it easier to identify patterns, trade-offs, and optimal configurations.


<Scatter3D />


