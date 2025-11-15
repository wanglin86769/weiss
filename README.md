# WEISS – Web EPICS Interface & Synoptic Studio

**WEISS** is a no-code, drag-and-drop tool for creating EPICS web operation interfaces.  
The system is built to be **intuitive, responsive, and user friendly**, allowing quick design and
usage of control panels. _TLDR_: [Getting Started](#getting-started).

## Why should you use web?

- **Client-side rendering** – most processing happens in the browser, drastically reducing server
  RAM and compute requirements.
- **Ease of access** – users can open the interface from any browser without installing specialized
  tools or relying on remote desktop sessions Access control remains simple to enforce through
  standard mechanisms such as network restrictions, authentication and reverse proxies.
- **Built for scale** – web deployment allows multiple users to access the system simultaneously
  without dedicated virtual machines or remote desktops.
- **Extensive community support** – web technologies have one of the largest developer ecosystems,
  offering libraries, tools, and best practices far beyond the scientific environment.
- **Integration friendly** – easy to connect with authentication systems (LDAP), version control
  (GitHub/GitLab), and other modern tools.

---

## Key Features

- **No-code, drag-and-drop interface**: rapidly create web operator panels without touching HTML or
  JS.
- **Fully featured editor**: Use standard editor tools like widget alignment, grid snapping, layers
  management, widget grouping and others via keyboard shortcuts or mouse interaction.
- **Live EPICS PV communication**: supports both Channel Access (CA) and PV Access (PVA) protocols
  via modern implementations [p4p](https://github.com/epics-base/p4p/) and
  [caproto](https://github.com/caproto/caproto).
- **Runtime vs edit mode**: instantly start and stop communication with a switch button.
- **Extensible widget library**: ready-to-use components for common controls and displays, others
  can be easily created.
- **Responsive and intuitive design** : A considerable effort was put into user experience and
  making things intuitive.
- **Portable file format (JSON)**: All OPIs can be exported or imported using straightforward JSON
  files. Easily create or edit OPIs programatically as you will.

A set of new features is planned to be implemented, mostly on the access control and OPI management
context. Follow the app development and mapped improvements on
[WEISS Project Dashboard](https://github.com/orgs/weiss-core/projects/1/)

## Getting started

1. Install Docker (see https://docs.docker.com/engine/install/ for instructions).

> Tested with Docker Engine from 28.1.1, but most versions are expected to work fine.

2. Clone this repo:

```sh
git clone https://github.com/weiss-core/weiss.git
```

3. Create your `.env` file: Since we don't yet use secrets or certificates, you can just copy
   [.env.example](./.env.example):

```
cp .env.example .env
```

Use `.env` to configure EPICS communication settings (protocol: ca | pva, EPICS_CA_ADDR_LIST,
EPICS_PVA_ADDR_LIST, app version, etc.).

4. Launch the app:

### Production version

The production version for now is served over HTTP only. To start the app, run:

```
docker compose up -d
```

After built, two services should be launched:

- weiss-epicsws – the EPICS communication layer
- weiss – WEISS front-end application (accessible at http://localhost)

> :bulb: **_TIP:_** If you want to make sure things are working, you can use the demo IOC and OPI
> from development version (see below).

### Development version

For accessing the development version (with source code mounted + demoioc), run
`docker compose -f docker-compose-dev.yml up`.

This launches three services:

- weiss-demoioc – EPICS demonstration IOC for testing (see
  [examples/exampleIOC](examples/exampleIOC)).
- weiss-epicsws – EPICS WebSocket / PV communication layer
- weiss-dev – WEISS front-end application (localhost:5173)
- weiss-dev: The WEISS front-end application. It should be accessible in `localhost:5173`.

**Extra:** Use [example-opi.json](./examples/example-opi.json) to test the demo IOC:

1. Upload via the navbar "Upload File" button
2. Edit as desired
3. Click Preview to start EPICS communication

![Example image](./public/example.png)

## Notes

- Built with React + TypeScript
- UI components are based on Material UI: https://mui.com/material-ui/
- Some references used for this project: [Taranta](https://gitlab.com/MaxIV/web/taranta),
  [React Automation Studio](https://github.com/React-Automation-Studio/React-Automation-Studio),
  [PVWS](https://github.com/ornl-epics/pvws), [pyDM](https://github.com/slaclab/pydm),
  [Phoebus](https://github.com/ControlSystemStudio/phoebus).
