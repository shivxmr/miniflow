"""Shared request rate limiter (slowapi).

Applied only to the authentication routes to blunt credential-stuffing and
signup abuse. The client IP is the limit key.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
