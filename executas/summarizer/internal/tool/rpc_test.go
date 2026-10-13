package tool

import (
	"bufio"
	"encoding/json"
	"io"
	"strings"
	"testing"
	"time"
)

func TestTimeoutAndRecovery(t *testing.T) {
	inReader, input := io.Pipe()
	output, outWriter := io.Pipe()
	done := make(chan error, 1)
	go func() { done <- Serve(inReader, outWriter, io.Discard, 20*time.Millisecond); outWriter.Close() }()
	reader := bufio.NewReader(output)
	send := func(text string) {
		t.Helper()
		if _, err := io.WriteString(input, text+"\n"); err != nil {
			t.Fatal(err)
		}
	}
	read := func() frame {
		t.Helper()
		line, err := reader.ReadBytes('\n')
		if err != nil {
			t.Fatal(err)
		}
		var f frame
		if json.Unmarshal(line, &f) != nil {
			t.Fatalf("non-JSON stdout: %s", line)
		}
		return f
	}
	send(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2.0"}}`)
	read()
	send(`{"jsonrpc":"2.0","id":2,"method":"invoke","params":{"tool":"summarize","arguments":{"text":"A note"}}}`)
	if read().Method != "sampling/createMessage" {
		t.Fatal("no reverse sampling request")
	}
	f := read()
	if f.Error == nil || f.Error.Code != -32603 || !strings.Contains(f.Error.Message, "timed out") {
		t.Fatalf("no timeout error: %+v", f)
	}
	send(`{"jsonrpc":"2.0","id":3,"method":"describe"}`)
	if len(read().Result) == 0 {
		t.Fatal("process did not recover after timeout")
	}
	input.Close()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}

func TestVersionNegotiationAndMalformedInput(t *testing.T) {
	input := strings.NewReader("bad-json\n" + `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1.1"}}` + "\n")
	var output strings.Builder
	if err := Serve(input, &output, io.Discard, time.Second); err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(output.String()), "\n")
	if len(lines) != 2 {
		t.Fatalf("expected two responses: %s", output.String())
	}
	var invalid frame
	json.Unmarshal([]byte(lines[0]), &invalid)
	if invalid.Error == nil || invalid.Error.Code != -32700 {
		t.Fatal("parse error not reported")
	}
	var init struct {
		Result struct {
			ProtocolVersion string         `json:"protocolVersion"`
			Caps            map[string]any `json:"client_capabilities"`
		} `json:"result"`
	}
	json.Unmarshal([]byte(lines[1]), &init)
	if init.Result.ProtocolVersion != "1.1" || len(init.Result.Caps) != 0 {
		t.Fatal("sampling advertised without v2")
	}
}
