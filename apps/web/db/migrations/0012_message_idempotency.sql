-- Lets a retried answer submission (e.g. after a client-side timeout where
-- the server actually finished the write) be recognized as a duplicate of
-- an already-recorded turn instead of creating a second participant
-- message and running the model again.
alter table messages add column client_token text;
create unique index messages_session_client_token_idx on messages(session_id, client_token) where client_token is not null;
