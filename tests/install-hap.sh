#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
work=$(mktemp -d /data/storage/el2/base/cache/multica-install-test-XXXXXX)
trap 'rm -r "$work"' EXIT
mkdir -p "$work/bin" "$work/remote"
export MOCK_REMOTE="$work/remote" MOCK_HAP="$work/signed.hap"
printf 'current signed HAP fixture\n' > "$MOCK_HAP"
printf 'stale tail from a larger previous HAP\n' > "$MOCK_REMOTE/multica-install-part-zz"
cat > "$work/bin/hdc" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == file && "$2" == send ]]; then
  cp "$3" "$MOCK_REMOTE/$(basename "$4")"
elif [[ "$1" == shell ]]; then
  shift
  command="$*"
  case "$command" in
    'aa start '*)
      if [[ "${MOCK_START_FAIL:-0}" == 1 ]]; then
        echo 'error: failed to start ability.'
      else
        echo 'start ability successfully.'
      fi
      ;;
    'aa '*) exit 0 ;;
    'bm install '*)
      if [[ "${MOCK_INSTALL_FAIL:-0}" == 1 ]]; then
        echo 'error: failed to install bundle.'
        exit 0
      fi
      cmp "$MOCK_HAP" "$MOCK_REMOTE/multica-install.hap" || {
        echo 'FAIL: installed transfer contains stale remote parts' >&2
        exit 1
      }
      echo 'install bundle successfully.'
      ;;
    *)
      command=${command//\/data\/local\/tmp\//$MOCK_REMOTE/}
      bash -c "$command"
      ;;
  esac
else
  echo 'Unexpected mocked hdc command' >&2
  exit 1
fi
SH
chmod +x "$work/bin/hdc"
if ! PATH="$work/bin:$PATH" bash "$root/scripts/install-hap.sh" "$MOCK_HAP" --start > "$work/output.log" 2>&1; then
  cat "$work/output.log"
  exit 1
fi
cmp "$MOCK_HAP" "$MOCK_REMOTE/multica-install.hap"
echo 'PASS: a smaller HAP cannot inherit stale remote transfer parts'
if MOCK_INSTALL_FAIL=1 PATH="$work/bin:$PATH" bash "$root/scripts/install-hap.sh" "$MOCK_HAP" --start > "$work/failure.log" 2>&1; then
  echo 'FAIL: an installation error with hdc exit 0 was accepted'
  exit 1
fi
echo 'PASS: installation failure cannot be hidden by hdc exit 0'

MOCK_START_FAIL=1 PATH="$work/bin:$PATH" bash "$root/scripts/install-hap.sh" "$MOCK_HAP" --start > "$work/start-failure.log" 2>&1
grep -q 'WARN: aa start failed' "$work/start-failure.log"
echo 'PASS: launch failure with hdc exit 0 emits a warning'
