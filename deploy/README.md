# Auto-deploy for mylife-web

Checks `origin/main` every 5 minutes; when it has moved, fast-forwards, rebuilds,
and restarts the `mylife-web` service.

## Install

Run on the server, as root:

```bash
install -m 755 /srv/mylife-web/deploy/mylife-web-deploy.sh /usr/local/bin/mylife-web-deploy.sh
install -m 644 /srv/mylife-web/deploy/mylife-web-deploy.service /etc/systemd/system/
install -m 644 /srv/mylife-web/deploy/mylife-web-deploy.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now mylife-web-deploy.timer
```

The script is copied to `/usr/local/bin` rather than run from the checkout on
purpose: it lives in the repo it deploys, and running it in place means a pull
can rewrite the script while that same script is still executing.

Adjust `APP_DIR`, `BRANCH`, and `SERVICE` in the `.service` file if the checkout
is not at `/srv/mylife-web` or the unit is not called `mylife-web`.

## Check it

```bash
systemctl list-timers mylife-web-deploy.timer
```

```bash
journalctl -u mylife-web-deploy.service -n 50
```

Force a run without waiting for the timer:

```bash
systemctl start mylife-web-deploy.service
```

## Two things to set up first

**Git needs to authenticate without a prompt.** A systemd unit has no terminal,
so if the repo is private, a pull that wants a username hangs until the timeout
and every deploy silently stops. Use an SSH deploy key with the remote set to
the SSH URL:

```bash
sudo -u root ssh-keygen -t ed25519 -f /root/.ssh/mylife_deploy -N ""
```

Add the public key to the repo's Deploy Keys on GitHub (read-only is enough),
then point the checkout at SSH:

```bash
git -C /srv/mylife-web remote set-url origin git@github.com:Iliaddh/My-life-and-adventures-web.git
```

**`npm` must be on the unit's PATH.** systemd does not use your login shell's
PATH. If `npm` came from nvm or fnm it will not be found, and the deploy fails
with `npm: not found` even though it works when you run the script by hand.
Check where it actually is and put that directory in the `Environment=PATH=`
line of the `.service` file:

```bash
which npm
```

## Behaviour worth knowing

- **Restarts only on change.** An unchanged remote exits early. The alternative —
  restarting every 5 minutes regardless — drops live connections 288 times a day
  to redeploy identical bytes. Set `Environment=ALWAYS_RESTART=1` in the
  `.service` file for the unconditional version.
- **A failed build does not restart the service.** The old build keeps serving
  and the unit is marked failed, rather than bouncing the site into a broken
  state.
- **Uncommitted changes on the server abort the deploy** instead of being
  fast-forwarded over or discarded.
- **Diverged branches abort too** — the merge is `--ff-only`, so a commit made
  directly on the server needs a human rather than an automatic merge into
  production.
- **`npm ci` runs only when `package.json` or `package-lock.json` changed**,
  since a full reinstall on every deploy is slow and skipping it entirely builds
  against stale dependencies.

## If you want to be told when it breaks

The unit failing is invisible unless something is watching. The simplest hook:

```bash
systemctl edit mylife-web-deploy.service
```

and add an `OnFailure=` pointing at a unit that notifies you.
