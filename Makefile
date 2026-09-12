# Thin wrapper for Linux/CI runners (make isn't available in every dev
# environment — scripts/validate_all.py is the real cross-platform entry
# point; this just gives CI the conventional `make validate` command).

.PHONY: validate validate-fast update-baseline

validate:
	python scripts/validate_all.py

# Skips the MiniLM download/load and the PyTorch sanity retrain — useful
# for a quick local check; CI should use the full `validate` target.
validate-fast:
	python scripts/validate_all.py --skip-symbiosis --skip-autoencoder

update-baseline:
	python scripts/validate_all.py --update-baseline
