export type SubscriptionType = 'industry' | 'competitor' | 'tech' | 'policy';
export type SubscriptionFrequency = 'realtime' | 'daily' | 'weekly';

export interface SubscriptionProps {
  id: string;
  name: string;
  type: SubscriptionType;
  enabled: boolean;
  frequency: SubscriptionFrequency;
  tags: string[];
  lastUpdated: string;
  description: string;
}

export class Subscription {
  readonly id: string;
  readonly name: string;
  readonly type: SubscriptionType;
  readonly enabled: boolean;
  readonly frequency: SubscriptionFrequency;
  readonly tags: string[];
  readonly lastUpdated: string;
  readonly description: string;

  private constructor(props: SubscriptionProps) {
    this.id = props.id;
    this.name = props.name;
    this.type = props.type;
    this.enabled = props.enabled;
    this.frequency = props.frequency;
    this.tags = [...props.tags];
    this.lastUpdated = props.lastUpdated;
    this.description = props.description;
  }

  static create(props: SubscriptionProps): Subscription {
    return new Subscription(props);
  }

  toggleEnabled(): Subscription {
    return new Subscription({ ...this.toProps(), enabled: !this.enabled });
  }

  private toProps(): SubscriptionProps {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      enabled: this.enabled,
      frequency: this.frequency,
      tags: this.tags,
      lastUpdated: this.lastUpdated,
      description: this.description,
    };
  }
}
