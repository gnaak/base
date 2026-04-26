# app/module/infra/gpt_service.py

import base64
import json
import os
import tempfile
from typing import Any, List, Optional
import asyncio

import websockets
from openai import AsyncOpenAI
from starlette.datastructures import UploadFile

from app.core.config.settings import settings
from app.module.infra.redis.redis_service import RedisService
from app.module.web_socket.audio_utils import convert_pcm_to_wav

# OpenAI 비동기 클라이언트
client = AsyncOpenAI(api_key=settings.openai_api_key)

class GPTService:

    def __init__(self, redis_service: RedisService):
        self.redis_service = redis_service
