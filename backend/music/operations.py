"""Explicit operation policy. Model paths and executables are operator-only."""
import os
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Operation = Literal['vocals', 'four_stems', 'analyze', 'trim', 'midi', 'transcribe', 'clean_speech', 'loudness', 'separate_advanced']
TOOLS = ('analyze', 'trim', 'midi', 'transcribe', 'clean_speech', 'loudness', 'separate_advanced')


class Options(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    start_seconds: float | None = Field(default=None, ge=0, lt=600)
    end_seconds: float | None = Field(default=None, gt=0, le=600)
    target_lufs: float | None = Field(default=None, ge=-30, le=-8)

    @model_validator(mode='after')
    def validate_interval(self):
        if (self.start_seconds is None) != (self.end_seconds is None):
            raise ValueError('Provide both selection boundaries')
        if self.start_seconds is not None and self.end_seconds <= self.start_seconds:
            raise ValueError('Selection end must follow its start')
        return self


def validate_options(mode, raw):
    options = Options.model_validate(raw)
    values = options.model_dump(exclude_none=True)
    allowed = {'start_seconds', 'end_seconds'} if mode == 'trim' else {'target_lufs'} if mode == 'loudness' else set()
    if set(values) - allowed:
        raise ValueError('Settings do not match the selected operation')
    if mode == 'trim' and options.start_seconds is None:
        raise ValueError('Select a region before trimming')
    return values


def available_tools():
    configured = {name.strip() for name in os.getenv('MUSIC_TOOLS_ENABLED', '').split(',')}
    return [name for name in TOOLS if name in configured]
