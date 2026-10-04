import { jsPDF } from 'jspdf';
import {
  DocumentMetadata,
  NotesDocument,
  NoteVersion,
  StudySession,
} from '../types/workspace';

export type SampleDocKey = 'cs_fundamentals' | 'calculus' | 'python_dsa';

export interface SampleDocTemplate {
  key: SampleDocKey;
  title: string;
  fileName: string;
  subjectType: 'theory' | 'mathematics' | 'programming';
  description: string;
  pages: {
    pageNumber: number;
    heading: string;
    subheadings: string[];
    paragraphs: string[];
    formulas: string[];
    table?: { headers: string[]; rows: string[][] };
  }[];
}

export const SAMPLE_TEMPLATES: Record<SampleDocKey, SampleDocTemplate> = {
  cs_fundamentals: {
    key: 'cs_fundamentals',
    title: 'Computer Fundamentals & CPU Architecture',
    fileName: 'Computer_Fundamentals_CPU_Architecture.pdf',
    subjectType: 'theory',
    description: '6-page textbook chapter covering Von Neumann architecture, instruction cycle, cache hierarchy, and Amdahl’s Law.',
    pages: [
      {
        pageNumber: 1,
        heading: 'Chapter 1: The Von Neumann Architecture & System Bus',
        subheadings: ['1.1 Stored-Program Concept', '1.2 Core Functional Units'],
        paragraphs: [
          'Proposed by John von Neumann in 1945, the Stored-Program Concept establishes that both program instructions and data are stored together in a single read-write random-access memory (RAM) space. Prior to this architecture, computing machines required physical rewiring to execute different tasks.',
          'A standard Von Neumann processor comprises three foundational subsystems connected via a shared system bus: the Central Processing Unit (CPU), Main Memory (Primary Storage), and Input/Output (I/O) Interfaces.',
          'Within the CPU, the Control Unit (CU) directs the flow of signals and decodes instructions, while the Arithmetic Logic Unit (ALU) performs mathematical operations (addition, subtraction, bitwise shifts) and logical comparisons (AND, OR, XOR, NOT).',
          'The Von Neumann Bottleneck refers to the throughput limitation caused by sharing a single bus for both instruction fetches and data transfers between the CPU and main memory.'
        ],
        formulas: [
          'Throughput_Bus = (Bus_Width_Bits * Clock_Frequency_Hz) / 8 bytes/sec'
        ],
        table: {
          headers: ['Bus Line', 'Direction', 'Primary Function'],
          rows: [
            ['Address Bus', 'Unidirectional (CPU -> Memory)', 'Specifies physical memory location or I/O port'],
            ['Data Bus', 'Bidirectional', 'Transfers actual instructions and operands'],
            ['Control Bus', 'Bidirectional', 'Carries Read/Write, Interrupt, and Clock signals']
          ]
        }
      },
      {
        pageNumber: 2,
        heading: 'Chapter 2: CPU Registers & The Instruction Cycle',
        subheadings: ['2.1 Special-Purpose Registers', '2.2 Fetch-Decode-Execute Cycle'],
        paragraphs: [
          'Registers are ultra-fast storage locations located directly inside the CPU silicon. They operate at full processor clock speed with zero bus latency.',
          'Key architectural registers include: Program Counter (PC), which holds the memory address of the next instruction to be fetched; Instruction Register (IR), which stores the binary opcode currently being decoded; Memory Address Register (MAR), which feeds addresses to the address bus; and Memory Buffer/Data Register (MBR/MDR), which holds data waiting to be written to or read from RAM.',
          'Every instruction executes through a deterministic three-stage micro-operation cycle: Fetch (MAR <- [PC]; MDR <- Memory[MAR]; PC <- PC + 1; IR <- [MDR]), Decode (Control Unit interprets opcode and addressing mode), and Execute (ALU computes result and updates status flags Zero, Carry, Overflow, Sign).'
        ],
        formulas: [
          'T_exec = Instruction_Count (IC) * Cycles_Per_Instruction (CPI) * Clock_Cycle_Time (T_c)',
          'T_exec = (IC * CPI) / Clock_Rate (f)'
        ]
      },
      {
        pageNumber: 3,
        heading: 'Chapter 3: Memory Hierarchy & Cache Organization',
        subheadings: ['3.1 Principle of Locality', '3.2 Cache Hit Ratio & Effective Access Time'],
        paragraphs: [
          'Modern processors execute instructions in sub-nanosecond cycles, whereas main DRAM access requires 50 to 80 nanoseconds. To bridge this processor-memory speed gap, systems employ a hierarchical memory pyramid: Registers -> L1 Cache (SRAM) -> L2/L3 Cache -> Main Memory (DRAM) -> Secondary Storage (NVMe SSD).',
          'Cache effectiveness depends on the Principle of Locality: Temporal Locality states that recently accessed memory addresses are likely to be accessed again in the near future (e.g., loop counters and accumulators). Spatial Locality states that addresses adjacent to a recently accessed location are likely to be needed soon (e.g., sequential array traversal).',
          'When the CPU requests a word present in cache, a Cache Hit occurs. Otherwise, a Cache Miss triggers a block fetch from main memory.'
        ],
        formulas: [
          'Hit Ratio (h) = N_hits / (N_hits + N_misses)',
          'Effective Access Time (T_eff) = h * T_cache + (1 - h) * (T_cache + T_memory)'
        ],
        table: {
          headers: ['Memory Level', 'Technology', 'Typical Latency', 'Typical Capacity'],
          rows: [
            ['CPU Registers', 'Flip-Flops', '< 0.5 ns', '64 - 512 Bytes'],
            ['L1 Cache', 'Static RAM (SRAM)', '1 - 2 ns', '32 KB - 128 KB'],
            ['L2 / L3 Cache', 'Static RAM (SRAM)', '4 - 20 ns', '512 KB - 64 MB'],
            ['Main Memory', 'Dynamic RAM (DRAM)', '50 - 80 ns', '8 GB - 128 GB']
          ]
        }
      },
      {
        pageNumber: 4,
        heading: 'Chapter 4: Cache Mapping Techniques & Write Policies',
        subheadings: ['4.1 Direct, Associative, and Set-Associative Mapping', '4.2 Write-Through vs Write-Back'],
        paragraphs: [
          'Cache mapping determines how main memory blocks are placed into cache lines. In Direct Mapping, each memory block maps to exactly one specific cache line using modulo arithmetic. While simple and fast, it suffers from conflict misses when two active variables map to the same line.',
          'In Fully Associative Mapping, any memory block can occupy any cache line, requiring parallel comparator hardware across all tags. k-Way Set-Associative Mapping balances both approaches by dividing the cache into sets, each containing k lines.',
          'Write policies govern how cache modifications propagate to RAM. Write-Through updates both cache and main memory simultaneously, guaranteeing consistency at the cost of higher bus traffic. Write-Back updates only the cache line and sets a Dirty Bit, writing the block back to RAM only when the line is evicted.'
        ],
        formulas: [
          'Cache_Line_Index = (Memory_Block_Address) mod (Number_of_Cache_Lines)',
          'Physical_Address_Bits = Tag_Bits + Set_Index_Bits + Byte_Offset_Bits'
        ]
      },
      {
        pageNumber: 5,
        heading: 'Chapter 5: Instruction Pipelining & Amdahl’s Law',
        subheadings: ['5.1 5-Stage RISC Pipeline', '5.2 Pipeline Hazards & Speedup Limits'],
        paragraphs: [
          'Instruction pipelining overlaps the execution of multiple instructions, analogous to an industrial assembly line. A classic 5-stage RISC pipeline divides execution into: IF (Instruction Fetch), ID (Instruction Decode & Register Read), EX (Execute / Address Calculation), MEM (Memory Access), and WB (Write Back to Register File).',
          'Three classes of Pipeline Hazards prevent ideal single-cycle completion: Structural Hazards (hardware resource conflict), Data Hazards (Read-After-Write dependencies where an instruction needs a result not yet written back, mitigated via Operand Forwarding/Bypassing), and Control Hazards (branch instructions altering PC, mitigated via Branch Prediction).',
          'Amdahl’s Law quantifies the theoretical maximum speedup of a system when only a fraction f of the workload is parallelized or accelerated by a factor S.'
        ],
        formulas: [
          'Speedup_Pipeline = (n * k) / (k + (n - 1))  [where k = stages, n = instructions]',
          'Speedup_Amdahl = 1 / ((1 - f) + (f / S))'
        ]
      },
      {
        pageNumber: 6,
        heading: 'Chapter 6: RISC vs CISC Architectural Comparison',
        subheadings: ['6.1 Design Philosophies', '6.2 Architectural Summary Matrix'],
        paragraphs: [
          'Complex Instruction Set Computing (CISC, e.g., x86-64) emphasizes hardware-level instruction richness, supporting variable-length instructions, multi-clock complex operations, and direct memory-to-memory addressing modes to minimize program code size.',
          'Reduced Instruction Set Computing (RISC, e.g., ARM64, RISC-V) prioritizes simplicity and regularity: fixed-length 32-bit instructions, single-cycle execution for most instructions, hardwired control units instead of microcode ROM, and a strict Load/Store architecture where only LOAD and STORE instructions access memory.',
          'For university examinations, remember that RISC shifts complexity from silicon hardware to the optimizing compiler, enabling deeper pipelining and lower power dissipation.'
        ],
        formulas: [
          'Code_Size_RISC > Code_Size_CISC, but CPI_RISC (~1.0) << CPI_CISC (2.5 - 8.0)'
        ],
        table: {
          headers: ['Feature', 'RISC Architecture', 'CISC Architecture'],
          rows: [
            ['Instruction Length', 'Fixed (typically 32-bit)', 'Variable (1 to 15 bytes)'],
            ['Memory Access', 'Load/Store instructions only', 'Arithmetic ops can access memory directly'],
            ['Cycles Per Instruction', 'Single cycle (~1.0 CPI)', 'Multiple cycles (2 to 15+ CPI)'],
            ['Control Unit', 'Hardwired circuitry', 'Microprogrammed control store'],
            ['Register File', 'Large (32 to 128 general registers)', 'Smaller (8 to 16 general registers)']
          ]
        }
      }
    ]
  },
  calculus: {
    key: 'calculus',
    title: 'Calculus II: Integration & Differential Equations',
    fileName: 'Calculus_Differential_Equations.pdf',
    subjectType: 'mathematics',
    description: '5-page mathematics monograph on the Fundamental Theorem of Calculus, Integration by Parts, and First-Order ODEs.',
    pages: [
      {
        pageNumber: 1,
        heading: 'Section 1: The Fundamental Theorem of Calculus (FTC)',
        subheadings: ['1.1 Accumulation Functions', '1.2 Definite Integral Evaluation'],
        paragraphs: [
          'The Fundamental Theorem of Calculus establishes the inverse relationship between differentiation and integration, bridging local rates of change with global net accumulation.',
          'Part 1 states that if f(t) is continuous on [a, b], then the accumulation function F(x) = Integral from a to x of f(t) dt is differentiable on (a, b), and its derivative is F\'(x) = f(x). When combined with the Chain Rule for an upper limit g(x), we multiply by g\'(x).',
          'Part 2 provides the fundamental evaluation shortcut: to compute the definite integral of f(x) over [a, b], find any antiderivative F(x) such that F\'(x) = f(x) and evaluate F(b) - F(a).'
        ],
        formulas: [
          'd/dx [ Integral_(a)^(g(x)) f(t) dt ] = f(g(x)) * g\'(x)',
          'Integral_(a)^(b) f(x) dx = F(b) - F(a), where F\'(x) = f(x)'
        ]
      },
      {
        pageNumber: 2,
        heading: 'Section 2: Integration by Parts & LIATE Rule',
        subheadings: ['2.1 Product Rule Reversal', '2.2 Choosing u via LIATE Priority'],
        paragraphs: [
          'Integration by Parts is the integral counterpart of the differential product rule d(uv) = u dv + v du. Rearranging and integrating both sides yields the standard formula.',
          'Selecting which factor to assign as u (to differentiate) and which as dv (to integrate) follows the LIATE heuristic hierarchy: Logarithmic (ln x), Inverse trigonometric (arctan x, arcsin x), Algebraic (x^2, 3x), Trigonometric (sin x, cos x), and Exponential (e^x).',
          'Common Mistake: Forgetting to carry the minus sign when applying Integration by Parts twice consecutively (such as evaluating Integral of x^2 * e^x dx or Integral of e^x * sin(x) dx).'
        ],
        formulas: [
          'Integral u dv = u * v - Integral v du',
          'Integral_(a)^(b) u dv = [u * v]_(a)^(b) - Integral_(a)^(b) v du'
        ]
      },
      {
        pageNumber: 3,
        heading: 'Section 3: Separable First-Order Differential Equations',
        subheadings: ['3.1 Separation of Variables', '3.2 Initial Value Problems (IVPs)'],
        paragraphs: [
          'A first-order ordinary differential equation (ODE) is separable if it can be factored into the form dy/dx = g(x) * h(y). Assuming h(y) != 0, we divide by h(y) and multiply by dx to isolate all y terms on the left and all x terms on the right.',
          'Worked Example: Solve dy/dx = 2x * y^2 with initial condition y(0) = 1. Separating gives (1/y^2) dy = 2x dx. Integrating both sides yields -1/y = x^2 + C. Substituting x = 0, y = 1 gives C = -1. Solving explicitly for y yields y(x) = 1 / (1 - x^2).'
        ],
        formulas: [
          'Integral (1 / h(y)) dy = Integral g(x) dx + C',
          'Exponential Growth/Decay Law: dy/dt = k*y  ==>  y(t) = y_0 * e^(k*t)'
        ]
      },
      {
        pageNumber: 4,
        heading: 'Section 4: Linear First-Order ODEs & Integrating Factors',
        subheadings: ['4.1 Standard Linear Form', '4.2 Deriving mu(x)'],
        paragraphs: [
          'A linear first-order differential equation must first be written in Standard Form: dy/dx + P(x)y = Q(x). If the leading coefficient of dy/dx is not 1, divide the entire equation by a(x) before identifying P(x) and Q(x).',
          'We multiply every term by the Integrating Factor mu(x) = exp(Integral P(x) dx). By design, the left-hand side collapses via the Product Rule into d/dx [ mu(x) * y ].',
          'Integrating both sides with respect to x and dividing by mu(x) gives the explicit general solution.'
        ],
        formulas: [
          'Standard Form: dy/dx + P(x) * y = Q(x)',
          'Integrating Factor: mu(x) = e^( Integral P(x) dx )',
          'General Solution: y(x) = (1 / mu(x)) * [ Integral mu(x) * Q(x) dx + C ]'
        ]
      },
      {
        pageNumber: 5,
        heading: 'Section 5: Euler’s Numerical Method & Error Bounds',
        subheadings: ['5.1 Tangent Line Stepping', '5.2 Local vs Global Truncation Error'],
        paragraphs: [
          'When a differential equation dy/dx = f(x, y) cannot be solved analytically in closed form, Euler’s Method approximates the solution curve using piecewise linear tangent steps of step size h.',
          'Starting from initial point (x_0, y_0), each subsequent point is computed iteratively using the slope evaluated at the current coordinates.',
          'Euler’s Method is a first-order numerical technique: halving the step size h reduces the global truncation error by a factor of approximately 2.'
        ],
        formulas: [
          'x_(n+1) = x_n + h',
          'y_(n+1) = y_n + h * f(x_n, y_n)',
          'Global Truncation Error = O(h), Local Truncation Error = O(h^2)'
        ],
        table: {
          headers: ['Step n', 'x_n', 'y_n (Euler h=0.1)', 'Slope f(x_n, y_n) = x_n + y_n'],
          rows: [
            ['0', '0.0', '1.000', '1.000'],
            ['1', '0.1', '1.100', '1.200'],
            ['2', '0.2', '1.220', '1.420'],
            ['3', '0.3', '1.362', '1.662']
          ]
        }
      }
    ]
  },
  python_dsa: {
    key: 'python_dsa',
    title: 'Data Structures & Algorithms in Python',
    fileName: 'Python_Data_Structures_Algorithms.pdf',
    subjectType: 'programming',
    description: '5-page programming study guide on Big-O complexity, Hash Maps, Binary Search Trees, and Dynamic Programming.',
    pages: [
      {
        pageNumber: 1,
        heading: 'Unit 1: Asymptotic Complexity & Big-O Analysis',
        subheadings: ['1.1 Growth Rates', '1.2 Python Built-in Container Operations'],
        paragraphs: [
          'Big-O notation characterizes the upper bound of an algorithm’s running time or memory footprint as input size n approaches infinity, ignoring constant factors and lower-order terms.',
          'In Python, a list is implemented as a dynamic contiguous array of pointers: indexing list[i] and appending list.append(x) run in O(1) amortized time, whereas inserting or popping at index 0 requires shifting n elements in O(n) time. For O(1) double-ended queue operations, always use collections.deque.',
          'A dict or set is implemented as an open-addressed hash table, delivering O(1) average-case lookup, insertion, and deletion.'
        ],
        formulas: [
          'O(1) < O(log n) < O(n) < O(n log n) < O(n^2) < O(2^n) < O(n!)'
        ],
        table: {
          headers: ['Operation', 'Python list', 'collections.deque', 'Python dict / set'],
          rows: [
            ['Access / Lookup', 'O(1) by index', 'O(n) by index', 'O(1) avg by key'],
            ['Append Right', 'O(1) amortized', 'O(1)', 'O(1) avg insert'],
            ['Pop / Insert Left', 'O(n)', 'O(1)', 'N/A'],
            ['Membership (x in s)', 'O(n) linear scan', 'O(n)', 'O(1) avg hash lookup']
          ]
        }
      },
      {
        pageNumber: 2,
        heading: 'Unit 2: Binary Search & Two-Pointer Patterns',
        subheadings: ['2.1 Overflow-Safe Midpoint', '2.2 Monotonic Condition Search'],
        paragraphs: [
          'Binary Search halves the search space on every iteration, requiring O(log n) comparisons and O(1) auxiliary space on a sorted sequence.',
          'Implementation Pattern: Initialize left = 0 and right = len(nums) - 1. While left <= right, compute mid = left + (right - left) // 2. If nums[mid] == target, return mid; if nums[mid] < target, advance left = mid + 1; else shrink right = mid - 1.',
          'Common Bug: Using left < right without checking the final boundary element, or updating left = mid which causes an infinite loop when right == left + 1.'
        ],
        formulas: [
          'Recurrence: T(n) = T(n/2) + O(1)  ==>  T(n) = O(log_2 n)'
        ]
      },
      {
        pageNumber: 3,
        heading: 'Unit 3: Binary Search Trees (BST) & Tree Traversals',
        subheadings: ['3.1 BST Invariant', '3.2 Inorder, Preorder, Postorder & Level-Order'],
        paragraphs: [
          'A Binary Search Tree enforces the strict ordering invariant: for every node N, all keys in N.left are strictly less than N.val, and all keys in N.right are strictly greater than N.val.',
          'An Inorder Traversal (Left -> Root -> Right) of any valid BST visits nodes in strictly ascending sorted order. Preorder (Root -> Left -> Right) is used for tree serialization, and Postorder (Left -> Right -> Root) is used for bottom-up height or subtree sum calculations.',
          'While balanced BSTs guarantee O(log n) height, inserting already-sorted data into an unbalanced BST degenerates into a linked list with O(n) height.'
        ],
        formulas: [
          'Balanced BST Height: h = floor(log_2 n)',
          'Time Complexity: O(h) = O(log n) average, O(n) worst-case skewed'
        ]
      },
      {
        pageNumber: 4,
        heading: 'Unit 4: Graph Traversals — BFS vs DFS',
        subheadings: ['4.1 Breadth-First Search (Queue)', '4.2 Depth-First Search (Stack / Recursion)'],
        paragraphs: [
          'Breadth-First Search (BFS) explores vertices layer by layer using a FIFO Queue (collections.deque). In an unweighted graph, BFS is guaranteed to find the shortest path (minimum number of edges) from the source to any target vertex.',
          'Depth-First Search (DFS) plunges along a path to its deepest unvisited vertex before backtracking, implemented via recursion or an explicit LIFO stack. DFS is ideal for cycle detection, topological sorting, and connected component counting.',
          'Critical Rule: Mark a node as visited immediately BEFORE enqueuing it in BFS, rather than when popping it, to prevent duplicate enqueuing.'
        ],
        formulas: [
          'Time Complexity (Adjacency List): O(V + E)',
          'Space Complexity: O(V) for visited set and queue/recursion stack'
        ]
      },
      {
        pageNumber: 5,
        heading: 'Unit 5: Dynamic Programming — Memoization vs Tabulation',
        subheadings: ['5.1 Overlapping Subproblems & Optimal Substructure', '5.2 Top-Down vs Bottom-Up'],
        paragraphs: [
          'Dynamic Programming (DP) optimizes recursive algorithms that exhibit both Overlapping Subproblems (the same state is recomputed repeatedly) and Optimal Substructure (an optimal solution can be constructed from optimal solutions of subproblems).',
          'Top-Down Memoization caches recursive function calls using @functools.lru_cache(None) or a dictionary memo[state]. Bottom-Up Tabulation iteratively fills a DP table from base cases up to n, eliminating recursion stack overhead and often allowing space optimization from O(n) to O(1).'
        ],
        formulas: [
          '0/1 Knapsack Recurrence: dp[i][w] = max(dp[i-1][w], val[i] + dp[i-1][w - wt[i]])',
          'Climbing Stairs / Fibonacci: dp[i] = dp[i-1] + dp[i-2]'
        ]
      }
    ]
  }
};

export function generateSamplePdfBytes(docKey: SampleDocKey): Uint8Array {
  const template = SAMPLE_TEMPLATES[docKey];
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;

  template.pages.forEach((page, idx) => {
    if (idx > 0) {
      pdf.addPage();
    }

    // Header bar
    pdf.setFillColor(248, 250, 252);
    pdf.rect(0, 0, pageWidth, 42, 'F');
    pdf.setDrawColor(226, 232, 240);
    pdf.line(0, 42, pageWidth, 42);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(template.title.toUpperCase(), margin, 26);
    pdf.text(`PAGE ${page.pageNumber} OF ${template.pages.length}`, pageWidth - margin, 26, {
      align: 'right'
    });

    let y = 76;

    // Main Chapter Heading
    pdf.setFont('times', 'bold');
    pdf.setFontSize(17);
    pdf.setTextColor(15, 23, 42);
    const titleLines = pdf.splitTextToSize(page.heading, contentWidth);
    pdf.text(titleLines, margin, y);
    y += titleLines.length * 22 + 8;

    pdf.setDrawColor(37, 99, 235);
    pdf.setLineWidth(1.5);
    pdf.line(margin, y - 6, margin + 68, y - 6);
    pdf.setLineWidth(0.5);
    y += 12;

    if (page.subheadings.length > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(30, 64, 175);
      pdf.text(`Topics: ${page.subheadings.join('   •   ')}`, margin, y);
      y += 22;
    }

    pdf.setFont('times', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(30, 41, 59);

    page.paragraphs.forEach((para, pIdx) => {
      if (pIdx === 1 && page.subheadings[0]) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(15, 23, 42);
        pdf.text(page.subheadings[0], margin, y);
        y += 16;
        pdf.setFont('times', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(30, 41, 59);
      } else if (pIdx === 2 && page.subheadings[1]) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(15, 23, 42);
        pdf.text(page.subheadings[1], margin, y);
        y += 16;
        pdf.setFont('times', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(30, 41, 59);
      }

      const lines = pdf.splitTextToSize(para, contentWidth);
      pdf.text(lines, margin, y);
      y += lines.length * 15.5 + 12;
    });

    if (page.formulas.length > 0) {
      y += 4;
      const boxHeight = 28 + page.formulas.length * 18;
      pdf.setFillColor(239, 246, 255);
      pdf.setDrawColor(191, 219, 254);
      pdf.roundedRect(margin, y, contentWidth, boxHeight, 4, 4, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(30, 64, 175);
      pdf.text('KEY FORMULAS & EXPRESSIONS', margin + 12, y + 15);

      pdf.setFont('courier', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      page.formulas.forEach((formula, fIdx) => {
        pdf.text(formula, margin + 12, y + 32 + fIdx * 16);
      });
      y += boxHeight + 18;
    }

    if (page.table && y < pageHeight - 130) {
      const colCount = page.table.headers.length;
      const colWidth = contentWidth / colCount;
      const rowHeight = 20;

      pdf.setFillColor(241, 245, 249);
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(margin, y, contentWidth, rowHeight, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);
      page.table.headers.forEach((header, cIdx) => {
        pdf.text(header, margin + cIdx * colWidth + 6, y + 13);
      });
      y += rowHeight;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
      page.table.rows.forEach((row) => {
        pdf.setDrawColor(226, 232, 240);
        pdf.rect(margin, y, contentWidth, rowHeight, 'S');
        row.forEach((cell, cIdx) => {
          const truncated = cell.length > 34 ? cell.slice(0, 32) + '...' : cell;
          pdf.text(truncated, margin + cIdx * colWidth + 6, y + 13);
        });
        y += rowHeight;
      });
    }

    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, pageHeight - 36, pageWidth - margin, pageHeight - 36);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text('ScholarSync Academic Study Workspace • Grounded Document', margin, pageHeight - 22);
    pdf.text(`Page ${page.pageNumber}`, pageWidth - margin, pageHeight - 22, { align: 'right' });
  });

  const arrayBuffer = pdf.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

export function buildSampleDocumentMetadata(docKey: SampleDocKey): DocumentMetadata {
  const template = SAMPLE_TEMPLATES[docKey];
  return {
    id: `doc_${docKey}`,
    title: template.title,
    fileName: template.fileName,
    fileSize: 284600,
    pageCount: template.pages.length,
    uploadedAt: new Date().toISOString(),
    isScanned: false,
    subjectType: template.subjectType,
    summary: template.description,
    keyTopics: template.pages.map((p) => p.heading),
    pages: template.pages.map((p) => {
      const fullText = [
        p.heading,
        ...p.subheadings,
        ...p.paragraphs,
        ...(p.formulas.length ? ['Formulas:', ...p.formulas] : []),
        ...(p.table
          ? [
              p.table.headers.join(' | '),
              ...p.table.rows.map((r) => r.join(' | '))
            ]
          : [])
      ].join('\n\n');

      return {
        pageNumber: p.pageNumber,
        text: fullText,
        headings: [p.heading, ...p.subheadings],
        formulas: p.formulas,
        hasTables: Boolean(p.table),
        wordCount: fullText.split(/\s+/).length
      };
    })
  };
}

export function createSampleStudySession(docKey: SampleDocKey = 'cs_fundamentals'): StudySession {
  const doc = buildSampleDocumentMetadata(docKey);
  const now = new Date();
  const t1 = new Date(now.getTime() - 240000).toISOString();
  const t2 = new Date(now.getTime() - 180000).toISOString();
  const t3 = new Date(now.getTime() - 120000).toISOString();
  const t4 = new Date(now.getTime() - 60000).toISOString();

  if (docKey !== 'cs_fundamentals') {
    const initialNotes: NotesDocument = {
      documentId: doc.id,
      title: `${doc.title} — Study Notes`,
      subjectType: doc.subjectType,
      version: 1,
      updatedAt: now.toISOString(),
      sections: [
        {
          id: 'sec_overview',
          heading: 'Overview',
          category: 'overview',
          pageRefs: [1],
          blocks: [
            {
              id: 'b_ov_1',
              type: 'paragraph',
              content: doc.summary || `Structured study notes for ${doc.title}.`,
              pageRef: 1
            }
          ]
        },
        {
          id: 'sec_concepts',
          heading: 'Key Concepts',
          category: 'concepts',
          pageRefs: [1, 2],
          blocks: [
            {
              id: 'b_kc_1',
              type: 'bullet_list',
              content: 'Core chapter topics extracted from the document:',
              items: doc.pages.map((p) => `Page ${p.pageNumber}: ${p.headings[0]}`)
            }
          ]
        },
        {
          id: 'sec_formulas',
          heading: 'Formulas & Expressions',
          category: 'formulas',
          pageRefs: [1, 2, 3],
          blocks: doc.pages
            .filter((p) => p.formulas.length > 0)
            .slice(0, 3)
            .map((p, idx) => ({
              id: `b_form_${idx}`,
              type: 'formula',
              title: `Page ${p.pageNumber} Expression`,
              content: p.formulas.join('\n'),
              pageRef: p.pageNumber
            }))
        }
      ]
    };

    const v1: NoteVersion = {
      version: 1,
      timestamp: now.toISOString(),
      label: 'v1: Initial Study Outline',
      source: 'initial',
      snapshot: JSON.parse(JSON.stringify(initialNotes))
    };

    return {
      id: `session_${docKey}`,
      document: doc,
      currentPage: 1,
      createdAt: t1,
      updatedAt: now.toISOString(),
      messages: [
        {
          id: 'msg_welcome',
          role: 'assistant',
          mode: 'ask',
          responseType: 'EXPLANATION',
          content: `Loaded **${doc.title}** (${doc.pageCount} pages).\n\nI have indexed all ${doc.pageCount} pages, formulas, and tables. You can ask me questions about any page in **Ask / Explain** mode, or switch to **Change Notes** mode to build and refine your exam notes.`,
          timestamp: t1,
          citedPages: [1]
        }
      ],
      notes: initialNotes,
      noteVersions: [v1],
      versionIndex: 0
    };
  }

  const notesV1: NotesDocument = {
    documentId: doc.id,
    title: 'Computer Fundamentals & CPU Architecture',
    subjectType: 'theory',
    version: 1,
    updatedAt: t2,
    sections: [
      {
        id: 'sec_overview',
        heading: 'Overview',
        category: 'overview',
        pageRefs: [1, 2],
        blocks: [
          {
            id: 'blk_ov_1',
            type: 'paragraph',
            content:
              'Modern digital computers are built on the 1945 Von Neumann Stored-Program Concept, where instructions and data reside in a unified random-access memory (RAM) and are processed sequentially via the Fetch-Decode-Execute cycle.',
            pageRef: 1
          }
        ]
      },
      {
        id: 'sec_concepts',
        heading: 'Key Concepts',
        category: 'concepts',
        pageRefs: [1, 2, 3, 5],
        blocks: [
          {
            id: 'blk_kc_1',
            type: 'bullet_list',
            content: 'Core architectural pillars across Chapters 1–6:',
            items: [
              'System Bus Triad: Address Bus (unidirectional), Data Bus (bidirectional), and Control Bus (bidirectional signals). [Page 1]',
              'CPU Register File: Program Counter (PC), Instruction Register (IR), Memory Address Register (MAR), and Memory Data Register (MDR). [Page 2]',
              'Principle of Locality: Temporal locality (reusing recently accessed data) and Spatial locality (accessing adjacent memory blocks). [Page 3]',
              '5-Stage RISC Pipeline: IF -> ID -> EX -> MEM -> WB overlaps instruction execution to approach 1.0 CPI. [Page 5]'
            ],
            pageRef: 1
          }
        ]
      },
      {
        id: 'sec_definitions',
        heading: 'Definitions',
        category: 'definitions',
        pageRefs: [1, 3, 4],
        blocks: [
          {
            id: 'blk_def_1',
            type: 'definition',
            title: 'Von Neumann Bottleneck (Page 1)',
            content:
              'The throughput limitation caused by sharing a single physical bus for both instruction fetches and data transfers between the CPU and main memory.',
            pageRef: 1
          },
          {
            id: 'blk_def_2',
            type: 'definition',
            title: 'Write-Through vs. Write-Back Cache (Page 4)',
            content:
              'Write-Through updates both cache and main RAM immediately on every write; Write-Back updates only the cache line (setting a Dirty Bit) and writes to RAM only upon eviction.',
            pageRef: 4
          }
        ]
      },
      {
        id: 'sec_formulas',
        heading: 'Formulas',
        category: 'formulas',
        pageRefs: [2, 3, 5],
        blocks: [
          {
            id: 'blk_form_1',
            type: 'formula',
            title: 'CPU Execution Time Equation (Page 2)',
            content: 'T_exec = Instruction_Count (IC) × CPI × Clock_Cycle_Time (T_c) = (IC × CPI) / Clock_Rate',
            pageRef: 2
          },
          {
            id: 'blk_form_2',
            type: 'formula',
            title: 'Effective Memory Access Time (Page 3)',
            content: 'T_eff = h × T_cache + (1 - h) × (T_cache + T_memory)',
            pageRef: 3
          },
          {
            id: 'blk_form_3',
            type: 'formula',
            title: 'Amdahl’s Law for Overall Speedup (Page 5)',
            content: 'Speedup = 1 / ((1 - f) + (f / S))',
            pageRef: 5
          }
        ]
      },
      {
        id: 'sec_examples',
        heading: 'Examples',
        category: 'examples',
        pageRefs: [3, 6],
        blocks: [
          {
            id: 'blk_ex_1',
            type: 'example',
            title: 'Worked Cache Hit Ratio Calculation (Page 3)',
            content:
              'Suppose L1 cache latency T_cache = 2 ns, main DRAM latency T_memory = 60 ns, and hit ratio h = 0.95. Then T_eff = 0.95(2) + 0.05(2 + 60) = 1.9 + 3.1 = 5.0 ns (12× faster than raw DRAM access).',
            pageRef: 3
          },
          {
            id: 'blk_ex_2',
            type: 'table',
            title: 'RISC vs. CISC Architectural Comparison (Page 6)',
            content: 'Comparison of instruction set design philosophies:',
            tableData: {
              headers: ['Attribute', 'RISC (ARM64 / RISC-V)', 'CISC (x86-64)'],
              rows: [
                ['Instruction Width', 'Fixed (32-bit)', 'Variable (1 to 15 bytes)'],
                ['Memory Access', 'Load / Store only', 'Direct memory operands allowed'],
                ['Target CPI', '~1.0 cycle per instruction', 'Multi-cycle (2.5 to 8+ CPI)'],
                ['Control Unit', 'Hardwired logic', 'Microprogrammed ROM']
              ]
            },
            pageRef: 6
          }
        ]
      },
      {
        id: 'sec_revision',
        heading: 'Quick Revision',
        category: 'revision',
        pageRefs: [1, 2, 3, 5, 6],
        blocks: [
          {
            id: 'blk_rev_1',
            type: 'exam_tip',
            title: 'High-Yield Exam Checklist',
            content:
              '1. Address bus is unidirectional; Data bus is bidirectional.\n2. PC holds the address of the NEXT instruction; IR holds the CURRENT instruction.\n3. Read-After-Write (RAW) data hazards in pipelines are solved via Operand Forwarding.',
            pageRef: 5
          }
        ]
      }
    ]
  };

  const notesV2: NotesDocument = {
    ...JSON.parse(JSON.stringify(notesV1)),
    version: 2,
    updatedAt: t4,
    sections: [
      ...JSON.parse(JSON.stringify(notesV1.sections)),
      {
        id: 'sec_exam_questions',
        heading: 'Important Exam Questions',
        category: 'exam_qa',
        pageRefs: [1, 2, 3, 4, 5, 6],
        blocks: [
          {
            id: 'blk_eq_1',
            type: 'numbered_list',
            title: '5 High-Probability University Exam Questions',
            content: 'Grounded in Chapters 1–6 of the uploaded PDF:',
            items: [
              '[Page 1] Explain the Stored-Program Concept and why the shared system bus leads to the Von Neumann Bottleneck.',
              '[Page 2] Trace the exact micro-operations (MAR, MDR, PC, IR) during the Fetch phase of the Instruction Cycle.',
              '[Page 3–4] Distinguish between Temporal and Spatial Locality, and compare Direct Mapping vs. k-Way Set-Associative Cache.',
              '[Page 5] Describe Structural, Data (RAW), and Control hazards in a 5-stage RISC pipeline and how forwarding mitigates stalls.',
              '[Page 6] Contrast RISC and CISC architectures across instruction length, memory addressing, CPI, and control unit implementation.'
            ]
          }
        ]
      }
    ]
  };

  const versionHistory: NoteVersion[] = [
    {
      version: 1,
      timestamp: t2,
      label: 'v1: AI Generated Exam-Oriented Notes',
      source: 'ai',
      snapshot: notesV1
    },
    {
      version: 2,
      timestamp: t4,
      label: 'v2: AI Added 5 Important Exam Questions',
      source: 'ai',
      snapshot: notesV2
    }
  ];

  return {
    id: 'session_cs_fundamentals',
    document: doc,
    currentPage: 1,
    createdAt: t1,
    updatedAt: t4,
    messages: [
      {
        id: 'msg_1',
        role: 'user',
        mode: 'ask',
        content: 'Explain the Fetch-Decode-Execute cycle and register roles in simple terms.',
        timestamp: t1,
        pageContext: 2
      },
      {
        id: 'msg_2',
        role: 'assistant',
        mode: 'ask',
        responseType: 'EXPLANATION',
        content: `### Simple Explanation
Think of the CPU executing a program like a chef following a recipe card one step at a time (**Page 2**):

1. **Fetch (Get the next step):**
   - **PC (Program Counter)** points to the memory address of the next instruction.
   - That address is copied into **MAR (Memory Address Register)** and sent over the Address Bus.
   - RAM sends the instruction back into **MDR (Memory Data Register)**, and it moves into **IR (Instruction Register)** while **PC** increments by 1 (\`PC <- PC + 1\`).
2. **Decode (Understand the step):**
   - The **Control Unit (CU)** inspects the binary opcode inside **IR** to figure out what operation to perform.
3. **Execute (Run the step):**
   - The **ALU** performs the calculation or comparison and updates status flags (Zero, Carry, Overflow).

### Key Takeaway
**PC** always tracks the *next* instruction address, while **IR** holds the *current* instruction being decoded (**Page 2**). *(Notes were not modified in Ask / Explain mode.)*`,
        timestamp: t2,
        pageContext: 2,
        citedPages: [1, 2]
      },
      {
        id: 'msg_3',
        role: 'user',
        mode: 'change_notes',
        content: 'Add a section with 5 important exam questions covering pages 1 to 6.',
        timestamp: t3,
        pageContext: 1
      },
      {
        id: 'msg_4',
        role: 'assistant',
        mode: 'change_notes',
        responseType: 'NOTE_MODIFICATION',
        content: `I have added a new **Important Exam Questions** section to your notes with 5 high-probability university exam questions mapped to **Pages 1–6**, while keeping all your existing sections untouched.`,
        timestamp: t4,
        citedPages: [1, 2, 3, 4, 5, 6],
        noteChangeSummary: {
          operation: 'insert_section',
          targetSection: 'Important Exam Questions',
          versionCreated: 2,
          reason: 'Inserted 5 exam questions grounded in Pages 1–6 without altering existing sections.'
        }
      }
    ],
    notes: notesV2,
    noteVersions: versionHistory,
    versionIndex: 1
  };
}
