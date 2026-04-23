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
  feelingScore?: number;
  helpfulnessScore?: number;
}

// Qualtrics integration
export interface QualtricsParams {
  participantId: string;
  condition: string;
  sessionId: string;
}
