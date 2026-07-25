/**
 * OpenGrantIndex event kinds.
 *
 * See NIP.md for the full specification. All kinds below are addressable
 * (30000-39999) except OPPORTUNITY_ATTESTATION which is a regular event.
 */
export const OGI_KINDS = {
  /** Addressable: a single funding opportunity. */
  OPPORTUNITY: 35231,
  /** Addressable: a funding organisation. */
  FUNDER: 31457,
  /** Addressable: a grant that was already awarded (historical). */
  AWARD: 34011,
  /** Addressable: a crawler source manifest. */
  SOURCE: 37063,
  /** Addressable: a user's saved search / alert subscription. */
  SAVED_SEARCH: 30441,
  /** Regular: community assertion about an opportunity's current state. */
  ATTESTATION: 9987,
} as const;

/** NIP-51 bookmark set used to store saved opportunities. */
export const BOOKMARK_SET_KIND = 30003;
/** NIP-22 comment. */
export const COMMENT_KIND = 1111;

/** The `d` tag of the NIP-51 bookmark set holding saved opportunities. */
export const SAVED_SET_IDENTIFIER = 'opengrantindex';
