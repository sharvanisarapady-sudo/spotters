class ProviderError extends Error {
  /** @param {'config'|'auth'|'rate_limit'|'overloaded'|'timeout'|'network'|'bad_request'|'not_found'|'blocked'|'server'|'bad_response'} kind */
  constructor(kind, detail) {
    super(detail || kind);
    this.name = 'ProviderError';
    this.kind = kind;
  }
}
module.exports = { ProviderError };
