export type TrackType = 'bible' | 'church-history' | 'world-context';
export type PrecisionType = 'exact' | 'circa' | 'range' | 'disputed';
export type ZoomLevel = 1 | 2 | 3;

export interface EpochItem {
  id: string;
  title: string;
  subtitle?: string;
  track: TrackType;
  level: 1 | 2;
  parentEpoch: string | null;
  order: number;
  date: {
    start: number;
    end: number;
    precision: PrecisionType;
    display: string;
  };
  style: {
    color: string;
    scaleWeight: number;
  };
  summary: string;
  bodyHtml: string;
}

export interface EventItem {
  id: string;
  title: string;
  category: 'event' | 'person' | 'writing' | 'council' | 'ruler' | 'movement';
  track: TrackType;
  minZoomLevel: ZoomLevel;
  epoch: string;
  date: {
    start: number;
    end: number;
    precision: PrecisionType;
    display: string;
    alternatives: Array<{
      label: string;
      start: number;
      end: number;
      source: string;
    }>;
  };
  location?: {
    name: string;
    region?: string;
    coordinates?: [number, number];
  };
  media?: {
    thumbnail?: string | null;
    gallery?: string[];
    videoUrl?: string | null;
  };
  scriptureRefs: string[];
  sources: Array<{
    title: string;
    author?: string;
    type: 'primary' | 'secondary';
    url?: string;
  }>;
  relatedEvents: Array<{
    id: string;
    relation: 'cause' | 'effect' | 'prophecy-fulfillment' | 'continuation' | 'parallel';
    note?: string;
  }>;
  tags: string[];
  summary: string;
  bodyHtml: string;
}
