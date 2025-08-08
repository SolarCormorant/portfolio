---
id: security
title: Security
---

## Internalize Hops

- Each Hops component is internalized, so the source code is hidden from the end user and missing file issues are prevented.
## Kill Switch

- Each Hops component includes a validation gate that checks the machine’s MAC address to ensure authorized use, along with an expiration mechanism to prevent outdated code execution.

```jsx title="check_mac_adress"
import uuid
from datetime import datetime

def is_mac_authorized():
    authorized_macs = [
        "42:42:42:42:42:42",    # Me
        "aa:aa:aa:aa:aa:aa",    # Coworker One
        "bb:bb:bb:bb:bb:bb",    # Coworker Two
    ]
    mac = ':'.join(['{:02x}'.format((uuid.getnode() >> i) & 0xff)
                    for i in range(0, 8*6, 8)][::-1])
    return mac in authorized_macs

def expiration_date():
    today = datetime.today()
    exp_date = datetime(today.year, 9, 1)
    return today < exp_date 

if is_mac_authorized() and expiration_date():
    x = True
else:
    x = False
```

