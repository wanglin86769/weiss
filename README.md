# WEISS – Web EPICS Interface & Synoptic Studio

WEISS is a no-code, drag-and-drop system for building web-based EPICS operation interfaces. It
provides a responsive editor, live PV communication, and a lightweight deployment model.

> If you are in a hurry: [Getting Started](#getting-started).

Try it out: https://demo.weiss-controls.org.

![Example image](./public/example.png)

The demo connects to a real IOC. For the demo, all edits stay in your browser only. Use **Load
Demo** anytime to restore.

## Why should you use web?

- **Client-side rendering**: the client browser performs most work; backend load stays minimal.
- **Ease of access**: use any modern browser—no remote desktops or local tools required. Access
  control relies on standard security mechanisms (network restrictions, authentication, reverse
  proxies, etc).
- **Built for scale**: concurrent users do not require dedicated VMs or graphical sessions.
- **Global ecosystem**: web technologies have one of the largest developer ecosystems, offering
  libraries, tools, and best practices beyond the scientific environment niche.
- **Integration friendly**: easy to connect with authentication systems (LDAP), GitHub/GitLab, and
  other modern tools.

---

## Key Features

- **Drag-and-drop editor** with grid snapping, alignment, grouping, layering, keyboard shortcuts.
- **Live EPICS PV communication**: supports both Channel Access (CA) and PV Access (PVA) protocols
  via modern implementations [p4p](https://github.com/epics-base/p4p/) and
  [caproto](https://github.com/caproto/caproto).
- **Runtime vs edit mode**: instantly start and stop communication with a switch button.
- **Extensible widget library**: ready-to-use components for common controls and displays, others
  can be easily created.
- **Designed for usability** : responsive UI, straightforward layout logic, modern development
  stack.
- **Portable JSON format**: import/export or create OPIs programatically using simple JSON files.

Planned improvements (access control, OPI distribution, repository integration, etc.) are tracked in
the [WEISS Project Dashboard](https://github.com/orgs/weiss-controls/projects/1/).

## Getting started

1. Install Docker

Instructions: https://docs.docker.com/engine/install/.  
Tested with Docker Engine 28.1.1, but other versions should work.

> Tested with Docker Engine from 28.1.1, but most versions are expected to work fine.

1. Clone the repository:

```sh
git clone https://github.com/weiss-controls/weiss.git
```

3. Create your `.env` file: You can start by just copying [.env.example](./.env.example):

```sh
cp .env.example .env
```

Adjust EPICS variables as needed (`DEFAULT_PROTOCOL`, `EPICS_XXX_ADDR_LIST`, etc.). Other options
can remain at default values if desired.

## Running WEISS

### Production

The production setup is configured entirely through .env. HTTP and HTTPS are both supported.  
If using HTTPS, set:

```ini
ENABLE_HTTPS=true
SSL_CERT_FILE=/path/to/fullchain.pem
SSL_KEY_FILE=/path/to/privkey.pem
```

And start the system:

```sh
docker compose up -d
```

Once built, two services should be launched:

- `weiss-epicsws`: the EPICS communication layer.
- `weiss`: WEISS front-end application - accessible at http://<server_addr>:80 for HTTP or
  https://<server_addr>:443 for HTTPS (default ports).

Nginx handles routing and proxying. Configuration files are under [./nginx](./nginx).

> :bulb: **_TIP:_** you can test connectivity by loading the demo OPI from the development setup
> (see below).

### Development

The development version mounts the source code so you can see live changes. It also provides a
demoioc for convenience.

Run:

```sh
docker compose -f docker-compose-dev.yml up
```

This launches three services:

- `weiss-demoioc`: EPICS demonstration IOC (see [examples/exampleIOC](examples/exampleIOC)).
- `weiss-epicsws`: EPICS WebSocket / PV communication layer
- `weiss-dev`: The WEISS front-end application. It should be accessible in `http://localhost:5173`.

**Optional:** Use [example-opi.json](./examples/example-opi.json) to test the demo IOC.  
This can be done manually:

1. Upload via the navbar "Upload File" button
2. Edit as desired
3. Click Preview to start EPICS communication

Or automatically by setting `VITE_DEMO_MODE` in your `.env` file:

```ini
VITE_DEMO_MODE=true # Optional: set if you want the "Load demo" button as the live demo
```

This will make your app show a button that automatically does the example OPI.

## Notes

- Built with React + TypeScript
- UI components are based on Material UI: https://mui.com/material-ui/
- Some references used for this project: [Taranta](https://gitlab.com/tango-controls/web/taranta),
  [React Automation Studio](https://github.com/React-Automation-Studio/React-Automation-Studio),
  [PVWS](https://github.com/ornl-epics/pvws), [pyDM](https://github.com/slaclab/pydm),
  [Phoebus](https://github.com/ControlSystemStudio/phoebus).
