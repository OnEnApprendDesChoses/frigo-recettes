"""The HTTP API mounted at ``/api``; child packages declare access rules."""

from fastapi import params

dependencies: tuple[params.Depends, ...] = ()
