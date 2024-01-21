# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

from firebase_functions import https_fn
from firebase_admin import initialize_app
from langchain_community.chat_message_histories.firestore import (
    FirestoreChatMessageHistory,
)

message_history = FirestoreChatMessageHistory(
    collection_name="langchain-chat-history",
    session_id="user-session-id",
    user_id="user-id",
)

message_history.add_user_message("hi!")
message_history.add_ai_message("whats up?")

print(message_history)
# initialize_app()
#
#
# @https_fn.on_request()
# def on_request_example(req: https_fn.Request) -> https_fn.Response:
#     return https_fn.Response("Hello world!")