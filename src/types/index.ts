// ─── Two-Dimension model types ──────────────────────────────────────────────

export type TurnIntentChoice =
  | 'evaluation'
  | 'listening'
  | 'teaching'
  | 'concrete_info'
  | 'encouragement';

export interface PerspectiveDimension {
  score: number;
  explanation: string;
}

export interface TwoDimMentalModel {
  mental_model: {
    perspective: {
      validation_support: PerspectiveDimension;
      objectivity_information: PerspectiveDimension;
    };
    turn_intent: {
      choice: TurnIntentChoice;
      explanation: string;
    };
  };
}

export interface CombinedTwoDimModel {
  twoDim?: TwoDimMentalModel;
  perspectiveUser?: Record<string, number> | null;
  perspectiveUserReasons?: Record<string, string> | null;
  perspectiveUserReactions?: Record<string, 'up' | 'down'> | null;
  turnIntentUser?: TurnIntentChoice | null;
  turnIntentUserReason?: string | null;
}

export interface TwoDimTurnData {
  turnIndex: number;
  userMessageAt?: string;
  assistantMessageAt?: string;
  userMessage: string;
  assistantMessage: string;
  twoDimAI?: TwoDimMentalModel;
  perspectiveUser?: Record<string, number>;
  perspectiveUserReasons?: Record<string, string>;
  perspectiveReactions?: Record<string, 'up' | 'down'>;
  turnIntentUser?: TurnIntentChoice;
  turnIntentUserReason?: string;
  highlights?: Highlight[];
}

// ─── No-Assumption (self-report) types ──────────────────────────────────────

export interface UserSelfReport {
  validationSupport?: number;
  objectivityInformation?: number;
  turnIntent?: TurnIntentChoice;
  turnIntentReason?: string;
}

export interface NeutralTurnData {
  turnIndex: number;
  userMessageAt?: string;
  assistantMessageAt?: string;
  userMessage: string;
  assistantMessage: string;
  selfReport?: UserSelfReport;
  highlights?: Highlight[];
}

// ─── Six-Dimension model types ───────────────────────────────────────────────

// Mental model types
export interface InductBelief {
  score: number;
  explanation: string;
}

export interface InductMentalModel {
  mental_model: {
    beliefs: {
      validation_seeking: InductBelief;
      user_rightness: InductBelief;
      user_information_advantage: InductBelief;
      objectivity_seeking: InductBelief;
    };
  };
}

export interface TypesSupportBelief {
  score: number;
  explanation: string;
}

export interface TypesSupportMentalModel {
  mental_model: {
    support_seeking: {
      emotional_support: TypesSupportBelief;
      social_companionship: TypesSupportBelief;
      belonging_support: TypesSupportBelief;
      information_guidance: TypesSupportBelief;
      tangible_support: TypesSupportBelief;
    };
  };
}

export interface CombinedMentalModel {
  induct?: InductMentalModel;
  typesSupport?: TypesSupportMentalModel;
  inductUser?: Record<string, number> | null;
  typesSupportUser?: Record<string, number> | null;
  inductUserReasons?: Record<string, string> | null;
  typesSupportUserReasons?: Record<string, string> | null;
  inductUserReactions?: Record<string, "up" | "down"> | null;
  typesSupportUserReactions?: Record<string, "up" | "down"> | null;
}

// Chat types
export interface Message {
  role: "user" | "assistant";
  content: string;
  createdAt?: string | null;
}

// Highlight types
export interface Highlight {
  selectedText: string;
  messageIndex: number;
  reaction: "up" | "down" | null;
  comment: string;
}

// Turn data for storage
export interface TurnData {
  turnIndex: number;
  userMessageAt?: string;
  assistantMessageAt?: string;
  userMessage: string;
  assistantMessage: string;
  inductAI?: InductMentalModel;
  typesSupportAI?: TypesSupportMentalModel;
  inductUser?: Record<string, number>;
  typesSupportUser?: Record<string, number>;
  inductUserReasons?: Record<string, string>;
  typesSupportUserReasons?: Record<string, string>;
  inductReactions?: Record<string, "up" | "down">;
  typesSupportReactions?: Record<string, "up" | "down">;
  highlights?: Highlight[];
  // feelingScore?: number;
  // helpfulnessScore?: number;
}

// Qualtrics integration
export interface QualtricsParams {
  participantId: string;
  condition: string;
  sessionId: string;
}
