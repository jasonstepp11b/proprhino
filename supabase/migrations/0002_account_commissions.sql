-- Round-trip commission per contract, applied at import for exports that
-- carry no fees (Tradovate). Micros and standard-size contracts are charged
-- at different rates.
alter table accounts
  add column commission_micro numeric(8, 2) not null default 0 check (commission_micro >= 0),
  add column commission_standard numeric(8, 2) not null default 0 check (commission_standard >= 0);
