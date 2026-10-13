package main

import (
	"os"
	"time"

	"github.com/123fool/anna-mini-notes/executas/summarizer/internal/tool"
)

func main() {
	if err := tool.Serve(os.Stdin, os.Stdout, os.Stderr, 60*time.Second); err != nil {
		os.Stderr.WriteString(err.Error() + "\n")
		os.Exit(1)
	}
}
