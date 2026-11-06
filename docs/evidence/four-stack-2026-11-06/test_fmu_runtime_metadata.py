from pathlib import Path
import pytest
from fastdyn.fmu_build import FmuBuild, FmuConfigError, runtime_metadata


def model(tmp_path, monkeypatch, token="actual-uuid", identifier="Rumoca_test"):
    monkeypatch.setattr("fastdyn.fmu_build.platform.machine", lambda: "aarch64")
    monkeypatch.setattr("fastdyn.fmu_build.platform.system", lambda: "Linux")
    (tmp_path / "modelDescription.xml").write_text(
        f'<fmiModelDescription instantiationToken="{token}"><CoSimulation modelIdentifier="{identifier}"/></fmiModelDescription>'
    )
    return FmuBuild("quad", "FastDyn.Copter", tmp_path / "Copter.mo", tmp_path, (), tmp_path, tmp_path, package=False)


def test_uses_actual_token_and_host_identifier(tmp_path, monkeypatch):
    build = model(tmp_path, monkeypatch)
    library = tmp_path / "binaries/aarch64-linux/Rumoca_test.so"
    library.parent.mkdir(parents=True)
    library.touch()
    assert runtime_metadata(build) == (str(library), "actual-uuid")


def test_missing_host_library_is_not_a_substitute_result(tmp_path, monkeypatch):
    with pytest.raises(FmuConfigError, match="Build the FMU host library"):
        runtime_metadata(model(tmp_path, monkeypatch))


@pytest.mark.parametrize("token", ["", "token,coverage=1"])
def test_invalid_token_rejected(tmp_path, monkeypatch, token):
    with pytest.raises(FmuConfigError, match="instantiationToken"):
        runtime_metadata(model(tmp_path, monkeypatch, token=token))


def test_path_traversal_identifier_rejected(tmp_path, monkeypatch):
    with pytest.raises(FmuConfigError, match="modelIdentifier"):
        runtime_metadata(model(tmp_path, monkeypatch, identifier="../elsewhere"))
