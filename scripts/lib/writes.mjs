// The write guard: the one definition of which accessible names or targets are never clicked.
//
// Anything matching WRITES is treated as a control that may write. Live Spatial Adjust pushes
// percent adjustments to Lynx, so a stray click waters a golf course. Shared by the fidelity
// harvest (scripts/fidelity-harvest.mjs), the video episode schema (video/lib/episode-schema.mjs)
// and, later, the capture director. Do not copy the pattern; import it.
export const WRITES = /save|apply|push|confirm|delete|remove|send|submit|discard|reset|update from/i;
