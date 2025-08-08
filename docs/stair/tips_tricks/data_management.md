---
id: data-management
title: Data Management
---

import ZoomableImage from '@site/src/components/ZoomableImage';

### Check New Data

- In this workflow, a centralized JSON structure aggregates all user-defined inputs, ensuring a unified source of truth across the definition. While centralizing inputs was essential since parameters like _Beam B Width_ influence multiple downstream components (e.g., step borders)—it also introduced a challenge: unrelated input changes could trigger unnecessary recomputations across unrelated Hops components.
- To address this, a custom locking mechanism was implemented. Before propagating input values to each Hops component, the system checks whether the relevant data has actually changed. If no changes are detected, the input is held, effectively bypassing redundant updates and preventing the recomputation of components unrelated to the modified parameter.
- This approach significantly improves performance by reducing unnecessary data flow and recomputation within Grasshopper and Hops workflows.

<ZoomableImage src="/img/data_management/deneme_1.png" alt="Human UI" />


### Reusing Hops with Different Keys    
- Many symmetrical components share the same Hops clusters but accept different inputs such as varying beam widths despite using identical definitions.
- Since deserialization requires constant keys, a gate system is used to extract values by type, reconstruct a new JSON structure with fixed keys, and then deserialize it. This ensures that each Hops component maintains a consistent and reliable data structure, even when inputs names vary.
- Each inner cluster typically requires around five or less inputs. This method not only ensures structural consistency in deeper parts of the algorithm but also keeps the input management tidy and well-organized.

<ZoomableImage src="/img/data_management/reusing_JSON.png" alt="Human UI" />



